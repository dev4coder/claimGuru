async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
  
    const ClaimManagement = await ethers.getContractFactory("ClaimManagement");
    const claimManagement = await ClaimManagement.deploy();
    console.log("ClaimManagement contract deployed to:", claimManagement.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  