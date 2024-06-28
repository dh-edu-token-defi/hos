import { BigNumberish } from "ethers";

import { encodeValues } from "./index";

export type YeeterParams = {
  isShares: boolean;
  feeRecipients: Array<`0x${string}`>;
  feeAmounts: Array<BigNumberish>;
  goal: BigNumberish;
  lootPerYeet: BigNumberish;
  minTribute: BigNumberish;
  multiplier: BigNumberish;
  startTimeInSeconds: BigNumberish;
  endTimeInSeconds: BigNumberish;
};

export const YEETER_SHAMAN_PERMISSIONS = "2";

export const assembleYeeterShamanParams = ({
  feeAmounts,
  feeRecipients,
  goal,
  isShares,
  minTribute,
  multiplier,
  startTimeInSeconds,
  endTimeInSeconds,
}: YeeterParams) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  // uint256 _startTime,
  // uint256 _endTime,
  // bool _isShares,
  // uint256 _minTribute,
  // uint256 _multiplier,
  // uint256 _goal,
  // address[] memory _feeRecipients,
  // uint256[] memory _feeAmounts
  return encodeValues(
    ["uint256", "uint256", "bool", "uint256", "uint256", "uint256", "address[]", "uint256[]"],
    [
      // Math.floor(Number(today) / 1000),
      startTimeInSeconds,
      // Math.floor(Number(tomorrow) / 1000),
      endTimeInSeconds,
      // DEFAULT_YEETER_VALUES.isShares,
      isShares,
      // price,
      minTribute,
      // DEFAULT_YEETER_VALUES.multiplier,
      multiplier,
      // "1000000000000000000", // goal?
      goal,
      // DEFAULT_YEETER_VALUES.feeRecipients,
      feeRecipients,
      // DEFAULT_YEETER_VALUES.feeAmounts,
      feeAmounts,
    ],
  );
};
