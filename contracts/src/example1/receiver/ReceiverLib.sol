//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

library ReceiverLib {
    bytes32 constant DIAMOND_STORAGE_POSITION =
        keccak256("receiverlib.v1.storage");

    enum OptionType {
        CALL,
        PUT
    }

    struct Order {
        string marketId;
        uint256 expDate;
        uint256 strikePrice;
        OptionType optionType;
    }

    struct Data {
        uint256 x;
        uint256[] y;
    }

    struct DiamondStorage {
        mapping(address => Order) orders;
        mapping(address => Data) data;
        address[] orderIds; // list of all order addresses (for view functions)
    }

    function diamondStorage()
        internal
        pure
        returns (DiamondStorage storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function setOrder(address callId, Order memory order) internal {
        DiamondStorage storage ds = diamondStorage();
        ds.orders[callId] = order;
        ds.orderIds.push(callId);
    }

    // Switchboard Function will call this function with the feed ids and values
    function handleCallback(
        address callId,
        uint256 x,
        uint256[] calldata y
    ) internal {
        DiamondStorage storage ds = diamondStorage();
        ds.data[callId] = Data({x: x, y: y});
    }

    function getOrderIds() internal view returns (address[] memory) {
        DiamondStorage storage ds = diamondStorage();
        return ds.orderIds;
    }

    function getOrders() internal view returns (Order[] memory) {
        DiamondStorage storage ds = diamondStorage();
        Order[] memory orders = new Order[](ds.orderIds.length);
        for (uint256 i = 0; i < ds.orderIds.length; i++) {
            orders[i] = ds.orders[ds.orderIds[i]];
        }
        return orders;
    }

    function getData() internal view returns (Data[] memory) {
        DiamondStorage storage ds = diamondStorage();
        Data[] memory data = new Data[](ds.orderIds.length);
        for (uint256 i = 0; i < ds.orderIds.length; i++) {
            data[i] = ds.data[ds.orderIds[i]];
        }
        return data;
    }
}
