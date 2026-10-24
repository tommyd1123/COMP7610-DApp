import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { compileStandardInput, projectRoot } from "./compile-contract.mjs";

export const deploymentDirectory = path.join(projectRoot, "artifacts/deployment");
const sourceName = "contracts/SeminarTickets.sol";
const contractName = "SeminarTickets";

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// No files are changed here; both the preparation CLI and verifier use this.
export async function createDeploymentBundle() {
  const { input, output, compiler } = await compileStandardInput();
  const contract = output.contracts[sourceName][contractName];
  // Prove that the exported standard JSON compiles without an import callback,
  // node_modules, a compiler download, or source retrieval over the network.
  const reproduced = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = reproduced.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  const reproducedContract = reproduced.contracts[sourceName][contractName];
  if (reproducedContract.evm.bytecode.object !== contract.evm.bytecode.object) {
    throw new Error("The self-contained standard input did not reproduce the creation bytecode");
  }
  const definition = output.sources[sourceName].ast.nodes.find(
    (node) => node.nodeType === "ContractDefinition" && node.name === contractName,
  );
  const organizer = definition.nodes.find(
    (node) => node.nodeType === "VariableDeclaration" && node.name === "organizer" && node.mutability === "immutable",
  );
  if (!organizer) throw new Error("The organizer immutable declaration was not found");
  const immutableReferences = contract.evm.deployedBytecode.immutableReferences;
  if (Object.keys(immutableReferences).length !== 1 || !immutableReferences[String(organizer.id)]?.length) {
    throw new Error("Unexpected immutable declarations; update deployment verification before proceeding");
  }
  const constructor = contract.abi.find((item) => item.type === "constructor");
  if (constructor?.inputs.length) throw new Error("Unexpected constructor parameters");
  const artifact = {
    contractName,
    sourceName,
    compiler,
    optimizer: input.settings.optimizer,
    evmVersion: input.settings.evmVersion,
    constructorArguments: [],
    constructorArgumentsEncoded: "0x",
    abi: contract.abi,
    creationBytecode: `0x${contract.evm.bytecode.object}`,
    runtimeBytecodeTemplate: `0x${contract.evm.deployedBytecode.object}`,
    immutableReferences,
    organizerImmutableId: String(organizer.id),
    metadata: JSON.parse(contract.metadata),
  };
  const files = {
    "standard-input.json": jsonText(input),
    "SeminarTickets.json": jsonText(artifact),
    "SeminarTickets.abi.json": jsonText(artifact.abi),
    "creation-bytecode.txt": `${artifact.creationBytecode}\n`,
    "metadata.json": jsonText(artifact.metadata),
  };
  const manifest = {
    contract: `${sourceName}:${contractName}`,
    compiler,
    optimizer: input.settings.optimizer,
    evmVersion: input.settings.evmVersion,
    constructorArguments: [],
    constructorArgumentsEncoded: "0x",
    deploymentValueWei: "0",
    organizerRule: "The deployment transaction sender is the fixed organizer.",
    sourceCount: Object.keys(input.sources).length,
    standardInputSelfContained: true,
    creationBytecodeReproduced: true,
    creationBytecodeSha256: sha256(Buffer.from(contract.evm.bytecode.object, "hex")),
    runtimeTemplateSha256: sha256(Buffer.from(contract.evm.deployedBytecode.object, "hex")),
    files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, {
      sha256: sha256(content),
      bytes: Buffer.byteLength(content),
    }])),
  };
  return { input, artifact, manifest, files };
}

export async function prepareDeployment() {
  const { manifest, files } = await createDeploymentBundle();
  await fs.mkdir(deploymentDirectory, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(deploymentDirectory, name), content);
  }
  await fs.writeFile(path.join(deploymentDirectory, "manifest.json"), jsonText(manifest));
  return { prepared: true, directory: deploymentDirectory, ...manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error("Usage: npm run prepare:deployment (no arguments)");
  console.log(jsonText(await prepareDeployment()).trimEnd());
}
