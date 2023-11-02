import {
  AttestationQueueAccount,
  FunctionAccount,
  SwitchboardProgram,
} from "@switchboard-xyz/evm.js";
import { ethers } from "hardhat";

// Alternative to deploying with CLI (useful if you want to deploy to a custom network)
async function main() {
  const [deployer] = await ethers.getSigners();

  const diamondAddress =
    process.env.SWITCHBOARD_ADDRESS ?? process.env.DIAMOND_ADDRESS ?? "";

  const schedule = process.env.SCHEDULE;
  const container = process.env.CONTAINER_NAME;
  const queueId = process.env.QUEUE_ID;
  const functionId =
    process.env.FUNCTION_ID ?? ethers.Wallet.createRandom().address;

  if (!diamondAddress) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_ADDRESS=..."
    );
  }

  if (!schedule) {
    throw new Error(
      'Please set the schedule, ex: export SCHEDULE="* * * * * *"'
    );
  }

  if (!container) {
    throw new Error(
      'Please set the container, ex: export CONTAINER_NAME="switchboardlabs/price-oracle"'
    );
  }

  if (!queueId) {
    throw new Error("Please set the queueid with: export QUEUE_ID=...");
  }

  console.log("Account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const switchboardProgram = await SwitchboardProgram.load(
    deployer,
    diamondAddress
  );

  const attestationQueue = new AttestationQueueAccount(
    switchboardProgram,
    queueId
  );

  const queueData = await attestationQueue.loadData();
  console.log(queueData);
  console.log(functionId);
  console.log(deployer.address!);
  console.log(queueId);
  console.log(container);
  console.log(schedule);
  const [func, tx] = await FunctionAccount.create(switchboardProgram, {
    authority: deployer.address,
    attestationQueue: queueId,
    name: container, // might as well name it the same thing as the img
    containerRegistry: "dockerhub",
    container: container,
    schedule: schedule,
    version: "latest",
  });

  const receipt = await tx.wait();
  console.log(`Function create signature: ${receipt.logs[0].transactionHash}`);
  console.log(`Function address: ${func.address}`);
  console.log(`Please run: export FUNCTION_ID=${func.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
