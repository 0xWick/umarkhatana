// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title HeistTrophy
/// @notice "I robbed Umar's agent": a soulbound badge for everyone who talked Warden into
///         releasing tokens from the AgentVault. One per address, never transferable.
/// @dev The minter is the agent key, and the agent's code (not the model) mints only after
///      a Released event is confirmed. Artwork and metadata live entirely on-chain.
///      Soulbound per ERC-5192: `locked` is always true and transfers revert.
contract HeistTrophy is ERC721, Ownable2Step {
    using Strings for uint256;

    struct Heist {
        uint64 releaseId; // AgentVault's release id
        uint64 at; // block timestamp of the mint
        uint128 amount; // base units of HEIST released
    }

    address public minter;
    uint256 public totalSupply;
    mapping(address => uint256) public trophyOf; // 0 = none; token ids start at 1
    mapping(uint256 => Heist) public heists;

    event MinterChanged(address indexed previous, address indexed current);
    event Locked(uint256 tokenId); // ERC-5192

    error NotMinter();
    error AlreadyHasTrophy(address to, uint256 tokenId);
    error Soulbound();

    constructor(address owner_, address minter_) ERC721("Robbed Umar's Agent", "ROBBED") Ownable(owner_) {
        _setMinter(minter_);
    }

    function mint(address to, uint256 releaseId, uint256 amount) external returns (uint256 id) {
        if (msg.sender != minter) revert NotMinter();
        if (trophyOf[to] != 0) revert AlreadyHasTrophy(to, trophyOf[to]);
        id = ++totalSupply;
        trophyOf[to] = id;
        heists[id] = Heist(uint64(releaseId), uint64(block.timestamp), uint128(amount));
        // _mint, not _safeMint: a recipient contract that can't hold NFTs must not block the agent.
        _mint(to, id);
        emit Locked(id);
    }

    function setMinter(address minter_) external onlyOwner {
        _setMinter(minter_);
    }

    /// @notice ERC-5192: every trophy is locked to the address that earned it.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId); // ERC-5192
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Heist memory h = heists[tokenId];
        string memory amount = (uint256(h.amount) / 1e18).toString();
        string memory svg = string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>",
            "<rect width='400' height='400' fill='#141413'/>",
            "<rect x='18' y='18' width='364' height='364' rx='20' fill='none' stroke='#86b4ff' stroke-width='2' stroke-dasharray='8 8'/>",
            "<text x='200' y='110' font-family='monospace' font-size='17' fill='#9b968c' text-anchor='middle'>I ROBBED UMAR&apos;S AGENT</text>",
            "<text x='200' y='215' font-family='monospace' font-size='76' font-weight='700' fill='#e6e3dc' text-anchor='middle'>#",
            tokenId.toString(),
            "</text><text x='200' y='268' font-family='monospace' font-size='22' fill='#e6e3dc' text-anchor='middle'>",
            amount,
            " HEIST</text><text x='200' y='335' font-family='monospace' font-size='14' fill='#86b4ff' text-anchor='middle'>release #",
            uint256(h.releaseId).toString(),
            " &#183; Base Sepolia</text></svg>"
        );
        string memory json = string.concat(
            '{"name":"Robbed Umar\'s Agent #',
            tokenId.toString(),
            '","description":"Talked Warden, an AI agent guarding an on-chain vault, into paying out. Soulbound. Play at umarkhatana.com/agent","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Release","value":',
            uint256(h.releaseId).toString(),
            '},{"trait_type":"HEIST","value":',
            amount,
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Minting is the only movement allowed: anything that already has an owner is locked.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function _setMinter(address minter_) private {
        emit MinterChanged(minter, minter_);
        minter = minter_;
    }
}
