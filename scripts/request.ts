import { ethers } from "hardhat";

// Trigger a request from the receiver contract to switchboard
async function main() {
  const sbPushAddress = process.env.CALLBACK_ADDRESS ?? "";

  if (!sbPushAddress) {
    throw new Error(
      "Please set the diamond address with: export CALLBACK_ADDRESS=..."
    );
  }

  // Handle Function Initialization
  const functionId = process.env.FUNCTION_ID ?? "";
  const admin = await ethers.getContractAt("Admin", sbPushAddress);
  const fnId = await admin.functionId();
  if (fnId == "0x0000000000000000000000000000000000000000") {
    console.log("Initializing admin function");
    if (!functionId) {
      throw new Error(
        "Please set the function id with: export FUNCTION_ID=..."
      );
    }
    const tx = await admin.setFunctionId(functionId);
    await tx.wait();
  }

  const push = await ethers.getContractAt("Receiver", sbPushAddress);

  // 0.00005502 ETH to run this function 
  const data = await push.triggerOrder(
    1698781846, // expiration
    2000, // strike price
    1, // CALL=0, PUT=1
    { value: ethers.utils.parseEther("0.00012") } // amount to cover the downstream request gas
  );

  const result = await data.wait();
  console.log("Result:", result);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
