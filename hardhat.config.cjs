// Hardhat supplies only the in-process EVM. Compilation uses the pinned npm solc.
module.exports = {
  networks: {
    hardhat: {
      hardfork: "cancun",
      chainId: 31337,
      accounts: { count: 60 },
    },
  },
};
