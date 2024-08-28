type Contracts = {
  baalSummoner: string;
  bvSummoner: string;
  btSummoner: string;
  yeet24ShamanModule?: string;
  yeeter?: string;
  sharesToken: string;
  lootToken?: string;
  univ3NftPositionManager?: string;
  weth?: string;
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
    sharesToken: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    lootToken: "0x0444AE984b9563C8480244693ED65F25B3C64a4E",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "0xCED608Aa29bB92185D9b6340Adcbfa263DAe075b",
  },
  "100": {
    // gnosis
    baalSummoner: "0x7e988A9db2F8597735fc68D21060Daed948a3e8C",
    bvSummoner: "0x594E630efbe8dbd810c168e3878817a4094bB312",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    sharesToken: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "137": {
    // polygon
    baalSummoner: "0x7e988A9db2F8597735fc68D21060Daed948a3e8C",
    bvSummoner: "0x594E630efbe8dbd810c168e3878817a4094bB312",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    sharesToken: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "42161": {
    // arbitrum
    baalSummoner: "0xb08Cc8C343cF6dC20d8cf51Fb2D6C436c6390dAa",
    bvSummoner: "0xC39E8D4DE75c6aC025a0C07dCd8Aeb0728C5DBF1",
    btSummoner: "0x8a4A9E36106Ee290811B89e06e2faFE913507965",
    sharesToken: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "",
    owner: "",
  },
  "10": {
    // optimism
    baalSummoner: "0x3E0eAdE343Ddc556a6Cf0f858e4f685ba303ce71",
    bvSummoner: "0xb04111e7b4576164145EF97EB81fd43DA0F2D675",
    btSummoner: "0x84561C97156a128662B62952890469214FDC87bf",
    yeet24ShamanModule: "",
    yeeter: "",
    sharesToken: "0x8124Cbb807A7b64123F3dEc3EF64995d8B10d3Eb",
    lootToken: "",
    univ3NftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    weth: "0x4200000000000000000000000000000000000006",
    owner: "",
  },
  "8453": {
    // base
    baalSummoner: "0x22e0382194AC1e9929E023bBC2fD2BA6b778E098",
    bvSummoner: "0x2eF2fC8a18A914818169eFa183db480d31a90c5D",
    btSummoner: "0x97Aaa5be8B38795245f1c38A883B44cccdfB3E11",
    sharesToken: "0xc650B598b095613cCddF0f49570FfA475175A5D5",
    lootToken: "0x59a7C71221d05e30b9d7981AB83f0A1700e51Af8", // gov loot
    yeet24ShamanModule: "0x2f3637757875414c938EF80A5aD197aAaCDaA924",
    yeeter: "0x8D60971eFf778966356c1cADD76d525E7B25cc6b",
    univ3NftPositionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    weth: "0x4200000000000000000000000000000000000006",
    owner: "0xCED608Aa29bB92185D9b6340Adcbfa263DAe075b",
  },
  "80001": {
    // mumbai
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    sharesToken: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "420": {
    // optimismGoerli
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    sharesToken: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "421613": {
    // arbitrumGoerli
    baalSummoner: "",
    bvSummoner: "",
    btSummoner: "",
    sharesToken: "",
    univ3NftPositionManager: "",
    weth: "",
    owner: "",
  },
  "11155111": {
    // sepolia
    baalSummoner: "0xB2B3909661552942AE1115E9Fc99dF0BC93d71d0",
    bvSummoner: "0x763f5c2E59f997A6cC48Bf1228aBf61325244702",
    btSummoner: "0xD69e5B8F6FA0E5d94B93848700655A78DF24e387",
    yeet24ShamanModule: "0x59a7C71221d05e30b9d7981AB83f0A1700e51Af8",
    yeeter: "0x62ff4ca410e9e58f5ce8b2ad03695ef0ad990381",
    sharesToken: "0x52acf023d38A31f7e7bC92cCe5E68d36cC9752d6",
    lootToken: "0x8a4a9e36106ee290811b89e06e2fafe913507965", // gov loot
    univ3NftPositionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    owner: "0xCED608Aa29bB92185D9b6340Adcbfa263DAe075b",
  },
};
