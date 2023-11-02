import { ethers } from "hardhat";

async function main() {
  const sbPushAddress = process.env.CALLBACK_ADDRESS ?? "";

  if (!sbPushAddress) {
    throw new Error(
      "Please set the diamond address with: export CALLBACK_ADDRESS=..."
    );
  }

  const push = await ethers.getContractAt("Receiver", sbPushAddress);
  const data = await push.getData();
  const [_orders, requests] = await push.getSwitchboardRequests();
  console.log("Data:", data);

  for (let i = 0; i < data.length; i++) {
    const requestFailed =
      requests[i].executed == true && requests[i].errorCode != 0;

    // Print request and order, plus data if there is any
    const request = requests[i];
    console.log(
      `Order ${i} -- executed ${request.executed}} -- balance ${
        request.balance
      } -- failed ${requestFailed} ${
        request.errorCode
      } -- failed because of gas limit reached ${
        request.errorCode === 203
      } -- failed because of low funding ${request.errorCode === 202} \n`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
