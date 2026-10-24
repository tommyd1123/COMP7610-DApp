// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Fixed versions work directly in Remix; the local compiler uses the same npm package.
import {ERC721} from "@openzeppelin/contracts@5.6.1/token/ERC721/ERC721.sol";
import {ERC721Utils} from "@openzeppelin/contracts@5.6.1/token/ERC721/utils/ERC721Utils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.6.1/utils/ReentrancyGuard.sol";

/// @title Free seminar tickets with transfers, returns and one-time check-in
/// @notice One ACTIVE ticket per address. USED tickets remain as non-transferable souvenirs.
contract SeminarTickets is ERC721, ReentrancyGuard {
    enum TicketState {
        AVAILABLE,
        ACTIVE,
        USED
    }

    uint256 public constant seatCap = 50;
    address public immutable organizer;

    uint256 public totalMinted;
    uint256 public activeCount;
    uint256 public usedCount;

    // Ticket IDs start at 1; 0 means that the address has no such ticket.
    mapping(address => uint256) public activeTicketOf;
    mapping(address => uint256) public enteredTicketOf;
    mapping(uint256 => TicketState) private _ticketStates;

    // Returned NFTs belong to the organizer and are reissued in last-in, first-out order.
    uint256[] private _returnedTickets;

    // Only claim() can authorize minting or releasing organizer inventory.
    // _update consumes this authorization BEFORE any ERC-721 receiver callback.
    uint256 private _claimingTokenId;

    error OrganizerOnly();
    error HolderOnly();
    error InvalidRecipient(address recipient);
    error AlreadyHasTicket(address account);
    error AlreadyEntered(address account);
    error SoldOut();
    error TicketNotActive(uint256 tokenId);
    error InventoryOnlyViaClaim();

    event TicketClaimed(address indexed account, uint256 indexed tokenId, bool reused);
    event TicketTransferred(address indexed from, address indexed to, uint256 indexed tokenId);
    event TicketReturned(address indexed account, uint256 indexed tokenId);
    event TicketAdmitted(address indexed account, uint256 indexed tokenId);

    constructor() ERC721("Seminar Tickets", "SEAT") {
        organizer = msg.sender;
    }

    /// @notice Seats already used for entry never become available again.
    function remaining() public view returns (uint256) {
        return seatCap - activeCount - usedCount;
    }

    function hasEntered(address account) public view returns (bool) {
        return enteredTicketOf[account] != 0;
    }

    /// @notice An unminted ID is not an AVAILABLE ticket: it reverts instead.
    function ticketState(uint256 tokenId) external view returns (TicketState) {
        _requireOwned(tokenId);
        return _ticketStates[tokenId];
    }

    /// @notice Claim a returned ticket first, or mint a new one if the pool is empty.
    function claim() external nonReentrant returns (uint256 tokenId) {
        _requireEligible(msg.sender);
        if (remaining() == 0) revert SoldOut();

        bool reused = _returnedTickets.length != 0;
        if (reused) {
            tokenId = _returnedTickets[_returnedTickets.length - 1];
            _returnedTickets.pop();
        } else {
            // No burning is exposed, so minted IDs are contiguous and never exceed 50.
            if (totalMinted == seatCap) revert SoldOut();
            tokenId = ++totalMinted;
        }

        _claimingTokenId = tokenId;
        if (reused) {
            _safeTransfer(organizer, msg.sender, tokenId);
        } else {
            _safeMint(msg.sender, tokenId);
        }
    }

    /// @notice Owner-only convenience function. Use returnTicket() to return a ticket.
    function transferTicket(address to, uint256 tokenId) external nonReentrant {
        _requireHolder(tokenId);
        if (to == organizer) revert InvalidRecipient(to);
        _safeTransfer(msg.sender, to, tokenId);
    }

    /// @notice Return an unused ticket to the fixed organizer; no payment or refund.
    function returnTicket(uint256 tokenId) external nonReentrant {
        _requireHolder(tokenId);
        // The organizer is the designated inventory custodian. It need not implement
        // IERC721Receiver: claim() can reissue inventory without its signature.
        _transfer(msg.sender, organizer, tokenId);
    }

    /// @notice Only the deployer can check in the CURRENT holder, identified by ticket ID.
    function admit(uint256 tokenId) external nonReentrant {
        if (msg.sender != organizer) revert OrganizerOnly();
        address holder = _requireOwned(tokenId);
        if (_ticketStates[tokenId] != TicketState.ACTIVE) revert TicketNotActive(tokenId);
        if (hasEntered(holder)) revert AlreadyEntered(holder);

        _ticketStates[tokenId] = TicketState.USED;
        delete activeTicketOf[holder];
        enteredTicketOf[holder] = tokenId;
        --activeCount;
        ++usedCount;

        // Keep the NFT in the holder's wallet. _update blocks every later transfer.
        emit TicketAdmitted(holder, tokenId);
    }

    /// @dev Standard ERC-721 entry points must use the same lock and business rules.
    function transferFrom(address from, address to, uint256 tokenId) public override nonReentrant {
        super.transferFrom(from, to, tokenId);
    }

    /// @dev The inherited three-argument overload delegates to this guarded overload.
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override nonReentrant {
        // Calling super.safeTransferFrom would call our guarded transferFrom again.
        // Use the base transfer directly, then perform the standard receiver check.
        super.transferFrom(from, to, tokenId);
        ERC721Utils.checkOnERC721Received(_msgSender(), from, to, tokenId, data);
    }

    function _requireHolder(uint256 tokenId) private view {
        if (_requireOwned(tokenId) != msg.sender) revert HolderOnly();
    }

    function _requireEligible(address account) private view {
        if (account == address(0) || account == address(this) || account == organizer) {
            revert InvalidRecipient(account);
        }
        if (hasEntered(account)) revert AlreadyEntered(account);
        if (activeTicketOf[account] != 0) revert AlreadyHasTicket(account);
    }

    /// @dev One place maintains ALL ownership-related state, including approved transfers.
    /// Every update completes before _safeMint/_safeTransfer can call a receiver.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Check ERC-721 permissions before changing any business state. The later
        // super._update call receives auth=0 because this check has already run.
        if (auth != address(0)) _checkAuthorized(from, auth, tokenId);
        if (to == address(0) || to == address(this) || to == from) revert InvalidRecipient(to);

        bool issuing = from == address(0) || from == organizer;
        if (issuing) {
            if (_claimingTokenId != tokenId || auth != address(0) || to != msg.sender) {
                revert InventoryOnlyViaClaim();
            }
            delete _claimingTokenId;
            _requireEligible(to);
            _ticketStates[tokenId] = TicketState.ACTIVE;
            activeTicketOf[to] = tokenId;
            ++activeCount;
        } else {
            if (_ticketStates[tokenId] != TicketState.ACTIVE) revert TicketNotActive(tokenId);
            delete activeTicketOf[from];

            if (to == organizer) {
                _ticketStates[tokenId] = TicketState.AVAILABLE;
                _returnedTickets.push(tokenId);
                --activeCount;
            } else {
                _requireEligible(to);
                activeTicketOf[to] = tokenId;
            }
        }

        address previousOwner = super._update(to, tokenId, address(0));
        if (issuing) {
            emit TicketClaimed(to, tokenId, from == organizer);
        } else if (to == organizer) {
            emit TicketReturned(from, tokenId);
        } else {
            emit TicketTransferred(from, to, tokenId);
        }
        return previousOwner;
    }
}
