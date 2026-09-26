// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {HeistTrophy} from "../src/HeistTrophy.sol";

contract HeistTrophyTest is Test {
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address thief = makeAddr("thief");
    address other = makeAddr("other");

    HeistTrophy trophy;

    function setUp() public {
        trophy = new HeistTrophy(owner, agent);
    }

    function test_mint_recordsTheHeist() public {
        vm.prank(agent);
        uint256 id = trophy.mint(thief, 7, 640 ether);

        assertEq(id, 1);
        assertEq(trophy.ownerOf(1), thief);
        assertEq(trophy.trophyOf(thief), 1);
        assertEq(trophy.totalSupply(), 1);
        (uint64 releaseId,, uint128 amount) = trophy.heists(1);
        assertEq(releaseId, 7);
        assertEq(amount, 640 ether);
        assertTrue(trophy.locked(1));
    }

    function testFuzz_mint_onlyMinter(address caller) public {
        vm.assume(caller != agent);
        vm.prank(caller);
        vm.expectRevert(HeistTrophy.NotMinter.selector);
        trophy.mint(thief, 1, 1 ether);
    }

    function test_mint_onePerAddress() public {
        vm.startPrank(agent);
        trophy.mint(thief, 1, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(HeistTrophy.AlreadyHasTrophy.selector, thief, 1));
        trophy.mint(thief, 2, 1 ether);
        vm.stopPrank();
    }

    function test_soulbound_transfersRevert() public {
        vm.prank(agent);
        trophy.mint(thief, 1, 1 ether);

        vm.startPrank(thief);
        vm.expectRevert(HeistTrophy.Soulbound.selector);
        trophy.transferFrom(thief, other, 1);
        vm.expectRevert(HeistTrophy.Soulbound.selector);
        trophy.safeTransferFrom(thief, other, 1);
        vm.stopPrank();
        assertEq(trophy.ownerOf(1), thief);
    }

    function test_supportsErc5192AndErc721() public view {
        assertTrue(trophy.supportsInterface(0xb45a3c0e));
        assertTrue(trophy.supportsInterface(0x80ac58cd));
    }

    function test_tokenURI_isOnChainJsonWithSvg() public {
        vm.prank(agent);
        trophy.mint(thief, 3, 250 ether);

        string memory uri = trophy.tokenURI(1);
        string memory prefix = "data:application/json;base64,";
        assertEq(_slice(uri, 0, bytes(prefix).length), prefix);
        string memory json = string(Base64.decode(_slice(uri, bytes(prefix).length, bytes(uri).length)));
        assertTrue(_contains(json, '"name":"Robbed Umar\'s Agent #1"'));
        assertTrue(_contains(json, '"value":250}'));
        assertTrue(_contains(json, "data:image/svg+xml;base64,"));
    }

    function test_tokenURI_revertsForMissingToken() public {
        vm.expectRevert();
        trophy.tokenURI(1);
    }

    function test_setMinter_onlyOwner() public {
        vm.prank(thief);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, thief));
        trophy.setMinter(thief);

        vm.prank(owner);
        trophy.setMinter(other);
        assertEq(trophy.minter(), other);

        vm.prank(agent);
        vm.expectRevert(HeistTrophy.NotMinter.selector);
        trophy.mint(thief, 1, 1 ether);
    }

    function _slice(string memory s, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = b[i];
        }
        return string(out);
    }

    function _contains(string memory haystack, string memory needle) private pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        for (uint256 i; i + n.length <= h.length; i++) {
            bool hit = true;
            for (uint256 j; j < n.length && hit; j++) {
                hit = h[i + j] == n[j];
            }
            if (hit) return true;
        }
        return false;
    }
}
