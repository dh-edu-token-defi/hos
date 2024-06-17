type Contracts = {
  baalSummoner: string;
  bvSummoner: string;
  btSummoner: string;
  shares: string;
  yeet24ShamanModule?: string;
  yeeter?: string;
  sharesToken?: string;
  lootToken?: string;
  univ3NftPositionManager: string;
  weth: string;
};

type Ownable = {
  owner: string;
};

export const deploymentConfig: { [key: string]: Contracts & Ownable } = {
  "1": {
    // mainnet
    baalSummoner: "0x7e988A9db2F8597735fc68D21060Daed948a3e8C",
    bvSummoner: "0x594E630efbe8dbd810c168e3878817a4094bB312",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    shares: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "100": {
    // gnosis
    baalSummoner: "0x7e988A9db2F8597735fc68D21060Daed948a3e8C",
    bvSummoner: "0x594E630efbe8dbd810c168e3878817a4094bB312",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    shares: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "137": {
    // polygon
    baalSummoner: "0x7e988A9db2F8597735fc68D21060Daed948a3e8C",
    bvSummoner: "0x594E630efbe8dbd810c168e3878817a4094bB312",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    shares: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "42161": {
    // arbitrum
    baalSummoner: "0xb08Cc8C343cF6dC20d8cf51Fb2D6C436c6390dAa",
    bvSummoner: "0xC39E8D4DE75c6aC025a0C07dCd8Aeb0728C5DBF1",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    shares: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "10": {
    // optimism
    baalSummoner: "0x3E0eAdE343Ddc556a6Cf0f858e4f685ba303ce71",
    bvSummoner: "0xb04111e7b4576164145EF97EB81fd43DA0F2D675",
    btSummoner: "0x84561C97156a128662B62952890469214FDC87bf",
    shares: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "80001": {
    // mumbai
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    shares: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "420": {
    // optimismGoerli
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    shares: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "421613": {
    // arbitrumGoerli
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    shares: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "11155111": {
    // sepolia
    baalSummoner: "0xB2B3909661552942AE1115E9Fc99dF0BC93d71d0",
    bvSummoner: "0x763f5c2E59f997A6cC48Bf1228aBf61325244702",
    btSummoner: "0xD69e5B8F6FA0E5d94B93848700655A78DF24e387",
    shares: "0x52acf023d38A31f7e7bC92cCe5E68d36cC9752d6",
    owner: "0xCED608Aa29bB92185D9b6340Adcbfa263DAe075b",
    yeet24ShamanModule: "0xC7d3bb83E91De885E2B714553496D169E279E5dc",
    yeeter: "0x62ff4ca410e9e58f5ce8b2ad03695ef0ad990381",
    sharesToken: "0x52acf023d38A31f7e7bC92cCe5E68d36cC9752d6",
    lootToken: "0x8a4a9e36106ee290811b89e06e2fafe913507965", // gov loot
    univ3NftPositionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  },
};
