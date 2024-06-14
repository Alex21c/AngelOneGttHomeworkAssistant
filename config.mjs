import chalk from "chalk";
export const ChalkSuccess = chalk.green;
export const ChalkError = chalk.red;
export const ChalkWarning = chalk.yellow;
import { SmartAPI, WebSocket, WebSocketV2 } from "smartapi-javascript";
export const smart_api = new SmartAPI({
  api_key: process.env.apiKey, // PROVIDE YOUR API KEY HERE
});

export const scriptsRealNames = {
  BankBees: "BANKBEES-EQ",
  GoldBees: "GOLDBEES-EQ",
  JuniorBees: "JUNIORBEES-EQ",
  Mid150Bees: "MID150BEES-EQ",
  NiftyBees: "NIFTYBEES-EQ",
  SilverBees: "SILVERBEES-EQ",
};
export const scriptsFormalNames = {
  "BANKBEES-EQ": "BankBees",
  "GOLDBEES-EQ": "GoldBees",
  "JUNIORBEES-EQ": "JuniorBees",
  "MID150BEES-EQ": "Mid150Bees",
  "NIFTYBEES-EQ": "NiftyBees",
  "SILVERBEES-EQ": "SilverBees",
};

export const investMentCapitalAllowedOneTenth = {
  BankBees: 2000,
  JuniorBees: 2000,
  Mid150Bees: 2000,
  NiftyBees: 2000,
  GoldBees: 2000,
  SilverBees: 2000,
};

export const tokensMap = new Map([
  ["BankBees", "11439"],
  ["JuniorBees", "10939"],
  ["Mid150Bees", "8506"],
  ["NiftyBees", "10576"],
  ["GoldBees", "14428"],
  ["SilverBees", "8080"],
]);

export const percentMappings = new Map([
  ["_2_Percent", 2],
  ["_5_Percent", 5],
  ["_8_Percent", 8],
  ["_3_Percent", 3],
  ["_6_Percent", 6],
  ["_9_Percent", 9],
]);

export const GttIds = {
  yesterdayClose: {
    _2_Percent: {
      BankBees: 3392320,
      JuniorBees: null,
      Mid150Bees: null,
      NiftyBees: 3392353,
    },
    _5_Percent: {
      BankBees: 3392316,
      JuniorBees: null,
      Mid150Bees: null,
      NiftyBees: 3369479,
    },
    _8_Percent: {
      BankBees: 3369404,
      JuniorBees: null,
      Mid150Bees: null,
      NiftyBees: 3369472,
    },

    // GOLD & SILVERBEES
    _3_Percent: {
      GoldBees: 2164053,
      SilverBees: 3456208,
    },
    _6_Percent: {
      GoldBees: 3369422,
      SilverBees: 2626641,
    },
    _9_Percent: {
      GoldBees: 2626646,
      SilverBees: 3369493,
    },
  },
  portfolio: {
    _5_Percent: {
      BankBees: 3369390,
      GoldBees: 3369428,
      JuniorBees: null,
      Mid150Bees: null,
      NiftyBees: 3369478,
      SilverBees: 3369502,
    },
  },
};
