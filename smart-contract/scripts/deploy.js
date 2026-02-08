const hre = require("hardhat");

async function main() {
  // 1. Get the contract factory
  const FileRegistry = await hre.ethers.getContractFactory("FileRegistry");

  // 2. Deploy the contract
  const fileRegistry = await FileRegistry.deploy();

  // 3. Wait for deployment to finish
  await fileRegistry.waitForDeployment();

  // 4. Log the address
  console.log("FileRegistry deployed to:", await fileRegistry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});