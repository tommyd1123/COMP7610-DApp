// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface ITickets {
    function ownerOf(uint256 tokenId) external view returns (address);
    function activeTicketOf(address account) external view returns (uint256);
    function remaining() external view returns (uint256);
}

// Test fixture: accepts/rejects an NFT, or attempts an arbitrary nested call.
contract TicketReceiver {
    address public immutable tickets;
    bytes public callbackPayload;
    bool public rejectReceipt;
    uint256 public callbackCount;
    bool public nestedCallSucceeded;
    bytes public nestedResult;
    address public observedOwner;
    uint256 public observedActiveTicket;
    uint256 public observedRemaining;

    error ReceiptRejected();

    constructor(address tickets_) {
        tickets = tickets_;
    }

    function configure(bytes calldata payload, bool reject_) external {
        callbackPayload = payload;
        rejectReceipt = reject_;
    }

    function execute(bytes calldata payload) external returns (bytes memory) {
        (bool success, bytes memory result) = tickets.call(payload);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external returns (bytes4)
    {
        require(msg.sender == tickets, "Unexpected NFT");
        callbackCount += 1;
        observedOwner = ITickets(tickets).ownerOf(tokenId);
        observedActiveTicket = ITickets(tickets).activeTicketOf(address(this));
        observedRemaining = ITickets(tickets).remaining();
        if (callbackPayload.length != 0) {
            (nestedCallSucceeded, nestedResult) = tickets.call(callbackPayload);
        }
        if (rejectReceipt) revert ReceiptRejected();
        return this.onERC721Received.selector;
    }
}

// Test fixture: deliberately lacks the ERC-721 receiver callback.
contract NonReceiver {}
