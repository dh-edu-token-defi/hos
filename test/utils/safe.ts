import { BigNumber, BigNumberish, ContractTransaction, Wallet } from "ethers";
import { ethers } from "hardhat";
import { buildSafeTransaction, executeTxWithSigners } from "@gnosis.pm/safe-contracts";
import { GnosisSafe, GnosisSafeProxyFactory } from "../../types";

export const getSaltNonce = (length = 24) => {
  let text = '';
  const possible = '0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const getSafeAddressFromRevertMessage = (e: any): string => {
  if (e.error.data) {
    return ethers.utils.getAddress(e.error.data.slice(138, 178));
  }
  const messages: string[] = e.error.split(' ');
  return messages.find((m) => m.match(/^0x[a-fA-F0-9]{40,44}$/))?.replace(',', '') ?? ethers.constants.AddressZero;
};

export const calculateSafeProxyAddress = async ({
  gnosisSafeProxyFactory,
  initializer = "0x",
  masterCopyAddress,
  saltNonce,
} : {
  gnosisSafeProxyFactory: GnosisSafeProxyFactory;
  initializer?: string;
  masterCopyAddress: string;
  saltNonce: string;
}) => {
  
  const signer = await ethers.getSigner(gnosisSafeProxyFactory.address);

  let expectedSafeAddress = ethers.constants.AddressZero;
  try {
    await gnosisSafeProxyFactory.connect(signer).estimateGas.calculateCreateProxyWithNonceAddress(
      masterCopyAddress,
      initializer,
      saltNonce,
      { from: gnosisSafeProxyFactory.address }
    );
  } catch (e: unknown) {
    expectedSafeAddress = getSafeAddressFromRevertMessage(e);
  } finally {
    return expectedSafeAddress;
  }
};

export const buildSetupSafeCalldata = ({
  data,
  fallbackHandler,
  owners,
  payment,
  paymentReceiver,
  paymentToken,
  threshold,
  to,
} : {
  owners: Array<string>;
  threshold: BigNumberish;
  to: string;
  data: string;
  fallbackHandler: string;
  paymentToken: string;
  payment: BigNumberish;
  paymentReceiver: string;
}) => {
  const safeAbi = [
    "function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external",
  ];
  const safeIface = new ethers.utils.Interface(safeAbi);
  return safeIface.encodeFunctionData(
    "setup",
    [
      owners,
      threshold,
      to,
      data,
      fallbackHandler,
      paymentToken,
      payment,
      paymentReceiver
    ],
  );
};

export const deploySafe = async ({
  initializerCalldata,
  safeProxyFactory,
  saltNonce,
  singletonAddress,
} : {
  initializerCalldata: string;
  safeProxyFactory: GnosisSafeProxyFactory;
  saltNonce: BigNumberish;
  singletonAddress: string;
}) => {
  const tx = await safeProxyFactory.createProxyWithNonce(singletonAddress, initializerCalldata, saltNonce);
  const receipt = await tx.wait();
  const events = receipt.events?.filter((e) => e.address === safeProxyFactory.address).map((e) => safeProxyFactory.interface.parseLog(e));
  if (!events?.length) throw new Error("Failed to deploy a Safe through SafeProxyFactory");
  const safeAddress = events[0].args.proxy;
  return (await ethers.getContractAt("GnosisSafe", safeAddress)) as GnosisSafe;
};

export const executeSafeTx = async ({
  to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver,
  safe,
  signers,
} : {
  to: string;
  value?: BigNumber | number | string;
  data?: string;
  operation?: number;
  safeTxGas?: number | string;
  baseGas?: number | string;
  gasPrice?: number | string;
  gasToken?: string;
  refundReceiver?: string;
  safe: GnosisSafe;
  signers: Array<Wallet>;
}) => {
  const safeTx = buildSafeTransaction(
    { to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce: (await safe.nonce()).toNumber() }
  );
  return executeTxWithSigners(safe, safeTx, signers) as Promise<ContractTransaction>;
};
