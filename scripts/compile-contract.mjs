import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

export const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const contractSource = "contracts/SeminarTickets.sol";
const receiverSource = "test/fixtures/TicketReceivers.sol";

function resolveImport(importPath) {
  // Remix supports this versioned package path; npm installs the same package
  // without the @version suffix. Both compilers therefore use OZ 5.6.1.
  const npmPath = importPath.replace(
    /^@openzeppelin\/contracts@5\.6\.1\//,
    "@openzeppelin/contracts/",
  );
  if (!npmPath.startsWith("@openzeppelin/contracts/")) {
    return { error: `Unsupported Solidity import: ${importPath}` };
  }
  try {
    return { contents: readFileSync(path.join(projectRoot, "node_modules", npmPath), "utf8") };
  } catch (error) {
    return { error: `Cannot load ${importPath}: ${error.message}` };
  }
}

// Pure compilation for deployment preparation and read-only verification.
// The returned standard input contains every imported file's actual content.
export async function compileStandardInput({ includeTests = false } = {}) {
  if (!solc.version().startsWith("0.8.30+")) {
    throw new Error(`Expected solc 0.8.30, found ${solc.version()}`);
  }
  const ozPackage = JSON.parse(await fs.readFile(
    path.join(projectRoot, "node_modules/@openzeppelin/contracts/package.json"), "utf8",
  ));
  if (ozPackage.version !== "5.6.1") {
    throw new Error(`Expected OpenZeppelin Contracts 5.6.1, found ${ozPackage.version}`);
  }

  const sourceNames = includeTests ? [contractSource, receiverSource] : [contractSource];
  const sources = {};
  for (const name of sourceNames) {
    sources[name] = { content: await fs.readFile(path.join(projectRoot, name), "utf8") };
  }
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "": ["ast"],
          "*": ["abi", "metadata", "evm.bytecode.object", "evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences"],
        },
      },
    },
  };
  const importedSources = {};
  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import(importPath) {
      const result = resolveImport(importPath);
      if (result.contents !== undefined) importedSources[importPath] = { content: result.contents };
      return result;
    },
  }));
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }
  for (const warning of output.errors ?? []) {
    console.warn(warning.formattedMessage);
  }
  Object.assign(input.sources, importedSources);
  return { input, output, compiler: solc.version() };
}

export async function compileContracts({ includeTests = false } = {}) {
  const { output, compiler } = await compileStandardInput({ includeTests });
  const sourceNames = includeTests ? [contractSource, receiverSource] : [contractSource];

  for (const sourceName of sourceNames) {
    for (const [contractName, contract] of Object.entries(output.contracts[sourceName])) {
      const artifact = {
        contractName,
        sourceName,
        compiler,
        evmVersion: "cancun",
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        immutableReferences: contract.evm.deployedBytecode.immutableReferences,
        metadata: contract.metadata,
      };
      const artifactDirectory = path.join(projectRoot, "artifacts", path.dirname(sourceName));
      await fs.mkdir(artifactDirectory, { recursive: true });
      await fs.writeFile(path.join(artifactDirectory, `${contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    }
  }
  const abi = output.contracts[contractSource].SeminarTickets.abi;
  await fs.mkdir(path.join(projectRoot, "src/config"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, "src/config/SeminarTickets.abi.json"), `${JSON.stringify(abi, null, 2)}\n`);
  return output.contracts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await compileContracts();
  console.log("Compiled SeminarTickets with solc 0.8.30 / OpenZeppelin 5.6.1 (Cancun).");
  console.log("ABI: src/config/SeminarTickets.abi.json");
}
