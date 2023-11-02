//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ReceiverLib} from "./ReceiverLib.sol";
import {AdminLib} from "../admin/AdminLib.sol";
import {ErrorLib} from "../error/ErrorLib.sol";

// Get the Switchboard Library - this is the Core Mainnet Deployment, you can swap this for one of the networks below
import {SwitchboardCallbackHandler} from "@switchboard-xyz/evm.js/contracts/SwitchboardCallbackHandler.sol";
import {ISwitchboard} from "@switchboard-xyz/evm.js/contracts/ISwitchboard.sol";

contract Receiver is SwitchboardCallbackHandler {
    // Handle Order Callbacks
    function callback(
        address callId,
        uint256 x,
        uint256[] calldata y
    ) external isSwitchboardCaller isFunctionId {
        // Set function id on first callback
        address functionId = getEncodedFunctionId();
        if (AdminLib.functionId() == address(0)) {
            AdminLib.setFunctionId(functionId);
        }

        // Route and handle callback
        ReceiverLib.handleCallback(callId, x, y);
    }

    // Trigger a request to Switchboard
    function triggerOrder(
        uint256 expirationDate, // unix timestamp
        uint256 strikePrice, // strike price
        ReceiverLib.OptionType optionType // 0 = CALL, 1 = PUT
    ) external payable {
        // Estimated Gas Cost (for the callback + oracle fees) - this is a rough estimate, but it must be at least the cost
        // of the callback function + oracle fees. If it's over, the remaining funds will be sent back to the protocol
        uint256 estimatedGasCost = AdminLib.switchboardGasCost() * tx.gasprice;

        // Check if the user has sent enough funds to cover at least the estimated gas cost + market fee
        if (msg.value < estimatedGasCost) {
            revert ErrorLib.InsufficientFunding(msg.value, estimatedGasCost);
        }

        // Get order data from the market
        ReceiverLib.Order memory order = ReceiverLib.Order({
            cid: address(this),
            marketId: "ETH",
            expDate: expirationDate, // unix timestamp
            strikePrice: strikePrice,
            optionType: optionType
        });

        // Encode the order data to pass to the switchboard function request
        // NOTE: We spread the fields here because solidity encodes structs with variable length fields differently
        bytes memory orderData = abi.encode(
            order.cid,
            order.marketId, // <-- strings are variable length
            order.expDate,
            order.strikePrice,
            order.optionType
        );

        // Create the Switchboard Function Request & store it
        ISwitchboard switchboard = ISwitchboard(AdminLib.switchboard());
        address callId = switchboard.sendRequest{value: msg.value}(
            AdminLib.functionId(),
            orderData
        );
        ReceiverLib.setOrder(callId, order);
    }

    // -- SwitchboardCallbackHandler functions --

    function getSwithboardAddress() internal view override returns (address) {
        return AdminLib.switchboard();
    }

    function getSwitchboardFunctionId()
        internal
        view
        override
        returns (address)
    {
        return AdminLib.functionId();
    }

    function getEncodedFunctionId() internal pure returns (address) {
        if (msg.data.length < 20) {
            revert SwitchboardCallbackHandler__MissingFunctionId();
        }

        address receivedFunctionId;
        assembly {
            receivedFunctionId := shr(96, calldataload(sub(calldatasize(), 20)))
        }
        return receivedFunctionId;
    }

    // -- view functions --

    function getOrders() external view returns (ReceiverLib.Order[] memory) {
        return ReceiverLib.getOrders();
    }

    function getData() external view returns (ReceiverLib.Data[] memory) {
        return ReceiverLib.getData();
    }

    function getSwitchboardRequests()
        external
        view
        returns (ReceiverLib.Order[] memory, ISwitchboard.Request[] memory)
    {
        ReceiverLib.Order[] memory orders = ReceiverLib.getOrders();
        ISwitchboard switchboard = ISwitchboard(AdminLib.switchboard());
        ISwitchboard.Request[] memory requests = new ISwitchboard.Request[](
            orders.length
        );
        address[] memory orderIds = ReceiverLib.getOrderIds();
        for (uint256 i = 0; i < orderIds.length; i++) {
            requests[i] = switchboard.requests(orderIds[i]);
        }
        return (orders, requests);
    }
}
