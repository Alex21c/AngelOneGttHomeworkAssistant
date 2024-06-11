import "dotenv/config";
import XLSX from "xlsx";

import { authenticator } from "otplib";
import { SmartAPI, WebSocket, WebSocketV2 } from "smartapi-javascript";
import fs from "node:fs";

let smart_api = new SmartAPI({
  api_key: process.env.apiKey, // PROVIDE YOUR API KEY HERE
});

const scriptsRealNames = {
  BankBees: "BANKBEES-EQ",
  GoldBees: "GOLDBEES-EQ",
  JuniorBees: "JUNIORBEES-EQ",
  Mid150Bees: "MID150BEES-EQ",
  NiftyBees: "NIFTYBEES-EQ",
  SilverBees: "SILVERBEES-EQ",
};
const scriptsFormalNames = {
  "BANKBEES-EQ": "BankBees",
  "GOLDBEES-EQ": "GoldBees",
  "JUNIORBEES-EQ": "JuniorBees",
  "MID150BEES-EQ": "Mid150Bees",
  "NIFTYBEES-EQ": "NiftyBees",
  "SILVERBEES-EQ": "SilverBees",
};

const investMentCapitalAllowedOneTenth = {
  BankBees: 2000,
  JuniorBees: 2000,
  Mid150Bees: 2000,
  NiftyBees: 2000,
  GoldBees: 2000,
  SilverBees: 2000,
};

const tokensMap = new Map([
  ["BankBees", "11439"],
  ["JuniorBees", "10939"],
  ["Mid150Bees", "8506"],
  ["NiftyBees", "10576"],
  ["GoldBees", "14428"],
  ["SilverBees", "8080"],
]);

const percentMappings = new Map([
  ["_2_Percent", 2],
  ["_5_Percent", 5],
  ["_8_Percent", 8],
  ["_3_Percent", 3],
  ["_6_Percent", 6],
  ["_9_Percent", 9],
]);

const GttIds = {
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
      BankBees: null,
      GoldBees: null,
      JuniorBees: null,
      Mid150Bees: null,
      NiftyBees: null,
      SilverBees: null,
    },
  },
};
function computeQuantity(
  investMentCapitalAllowedOneTenth,
  scriptName,
  limitPrice,
  percentFromYesterdayClose
) {
  // console.log(
  //   investMentCapitalAllowedOneTenth,
  //   limitPrice,
  //   percentFromYesterdayClose
  // );
  let quantity = investMentCapitalAllowedOneTenth[scriptName] / limitPrice;
  if (scriptName === "GoldBees" || scriptName === "SilverBees") {
    if (
      percentFromYesterdayClose === 0.06 ||
      percentFromYesterdayClose === 0.09
    ) {
      quantity *= 2;
    }
  } else {
    if (
      percentFromYesterdayClose === 0.05 ||
      percentFromYesterdayClose === 0.08
    ) {
      quantity *= 2;
    }
  }
  return Math.ceil(quantity);
}

function getClosingPrice(script, mapClosingPrices, scriptsRealNames) {
  return mapClosingPrices.get(scriptsRealNames[script]);
}

async function modifyGttOrder(orderDetail, smart_api) {
  console.log("Modifying GTT ORDER !");
  console.log(orderDetail);

  await smart_api.modifyRule(orderDetail);
}

function modifyGTTAccToYesterdayClose(GttIds, mapClosingPrices) {
  Object.entries(GttIds.yesterdayClose).forEach(([howMuchPercent, obj]) => {
    console.log(`\n:: Processing ${howMuchPercent}`);
    Object.entries(obj).forEach(([script, gttID]) => {
      if (gttID) {
        console.log(`:: ${script}: ${gttID}`);
        modifyGtt(
          gttID,
          script,
          percentMappings.get(howMuchPercent),
          mapClosingPrices
        );
        // now i want to get the yesterday closing price of current script
      }
    });
    // console.log(obj)
  });
}
// modifyGTTAccToYesterdayClose(GttIds);

async function initializeTheClosingPriceOfAllScripts(smart_api) {
  // console.log(smart_api);
  const scriptTokens = [];
  tokensMap.forEach((token, scriptName) => {
    scriptTokens.push(token);
  });

  let response = await smart_api.marketData({
    mode: "OHLC",
    exchangeTokens: {
      NSE: scriptTokens,
    },
  });
  try {
    const closingPrices = response?.data?.fetched;
    // Safeguard
    if (!closingPrices) {
      throw new Error("Unable to fetch Closing prices");
    }

    // creating map out of it
    const mapClosingPrices = new Map();
    closingPrices.forEach((data) => {
      mapClosingPrices.set(data.tradingSymbol, Number(data.ltp));
    });
    return mapClosingPrices;
  } catch (error) {
    throw error;
  }
}
async function fetchActiveGTTsAndStoreThemIntoFile(smart_api) {
  try {
    if (process.env.isFetchingActiveGTTsAllowed === "true") {
      console.log(":: Fetching Active GTTs And Storing Them into File");
      const response = await smart_api.ruleList({
        status: ["NEW"],
        page: 1,
        count: 100,
      });
      // console.log(response.data);
      fs.writeFileSync(
        "activeGTTsFetched.json",
        JSON.stringify(response.data, null, "\t")
      );
    }
  } catch (error) {
    throw error;
  }
}
function roundOffTriggerPrice(triggerPrice) {
  const dataSet = [
    [0.0, 0.05, 0.1],
    [0.11, 0.15, 0.2],
    [0.21, 0.25, 0.3],
    [0.31, 0.35, 0.4],
    [0.41, 0.45, 0.5],
    [0.51, 0.55, 0.6],
    [0.61, 0.65, 0.7],
    [0.71, 0.75, 0.8],
    [0.81, 0.85, 0.9],
    [0.91, 0.95, 1.0],
  ];

  let decimalPart = Number(
    (triggerPrice - Math.floor(triggerPrice)).toFixed(2)
  );

  // now try to find in which part of dataSet does this decimal part lies?
  for (let [low, mid, high] of dataSet) {
    // console.log(low, mid, high);
    if (decimalPart >= low && decimalPart <= high) {
      if (decimalPart === mid || decimalPart === high) {
        break;
      } else if (decimalPart > mid) {
        decimalPart = high;
        break;
      } else if (decimalPart < mid) {
        decimalPart = mid;
        break;
      }
    }
  }

  triggerPrice = Math.floor(triggerPrice) + decimalPart;

  return triggerPrice;
}

function saveIntoExcelFile(mapClosingPrices, holdingsPAndL) {
  // let me crate array of array in the format Script, NSE-Close, OverallG/L
  let data = [];
  data.push(["Script", "NSE-Close", "OverallG/L"]);
  Object.entries(scriptsRealNames).forEach(([scriptName, value]) => {
    data.push([
      scriptName,
      mapClosingPrices.get(scriptsRealNames[scriptName]),
      holdingsPAndL[scriptName] + "%",
    ]);
  });
  console.log(data);
  if (process.env.isFetchingAndSavingClosingAndPLIntoExcelAllowed !== "false") {
    console.log(":: Saving Closing Prices and Overall G/L into excel file!");
    // wrting to excel file
    var ws = XLSX.utils.aoa_to_sheet(data);
    /* create workbook and export */
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "closingPricesAndHoldingsPAndL.xlsx");
  }
}

async function fetchOverallGainLoss(smart_api) {
  try {
    console.log(":: Fetching overall G/L");
    let holdings = await smart_api.getHolding();
    if (holdings) {
      holdings = holdings.data;
    } else {
      throw new Error("failed to fetch overall P&L");
    }
    // creating simple mapping out of it
    const mappingPAndL = {};
    holdings.forEach((script) => {
      const scriptFormalName = scriptsFormalNames[script.tradingsymbol];
      if (scriptFormalName !== undefined) {
        mappingPAndL[scriptFormalName] = script.pnlpercentage;
      }
    });

    return mappingPAndL;
  } catch (error) {
    throw error;
  }
}

function modifyGtt(
  gttID,
  scriptName,
  percentFromPreviousClose,
  mapClosingPrices
) {
  try {
    const closingPrice = getClosingPrice(
      scriptName,
      mapClosingPrices,
      scriptsRealNames
    );

    // 2% from yesterday close
    const xPercent = percentFromPreviousClose / 100;
    const limitPrice = Number(
      (closingPrice - closingPrice * xPercent).toFixed(2)
    );

    const triggerPrice = roundOffTriggerPrice(limitPrice + 0.01);
    // now i want to make sure that trigger price be either .05 or .00 whole number

    const quantity = computeQuantity(
      investMentCapitalAllowedOneTenth,
      scriptName,
      limitPrice,
      xPercent
    );

    console.log(
      `script: ${scriptName} closingPrice: ${closingPrice}, limitPrice: ${limitPrice}, triggerPrice:${triggerPrice}, quantity: ${quantity}`
    );

    const orderDetail = {
      id: gttID,
      symboltoken: tokensMap.get(scriptName),
      exchange: "NSE",
      qty: quantity, //<<<<<<<<<<----------- Need to work from here, how to compute quantity?
      price: limitPrice,
      triggerprice: triggerPrice, //<<---- work on this as well, instead of 499.02 it should give me 499 i.e. should point to nearer .5 or 0
    };
    // making API Call
    if (process.env.isAllowedToModifyGTTOrders !== "false") {
      modifyGttOrder(orderDetail, smart_api);
    }
  } catch (error) {
    throw new Error("Failed to modify GTT, ", error.message);
  }
}

async function init() {
  smart_api.setSessionExpiryHook(() => {
    console.log(":: +++++++++++++Logging Out");
  });
  try {
    // authenticate
    await smart_api.generateSession(
      process.env.clientId,
      process.env.mpin,
      authenticator.generate(process.env.totp)
    );

    // return;
    // do the work

    // fetching latest GTTs
    fetchActiveGTTsAndStoreThemIntoFile(smart_api);

    // fetching holding
    const holdingsPAndL = await fetchOverallGainLoss(smart_api);

    // Getting closing prices
    console.log(":: Fetching Closing Prices");
    const mapClosingPrices = await initializeTheClosingPriceOfAllScripts(
      smart_api
    );
    // console.log(mapClosingPrices);

    // saving into excel file
    saveIntoExcelFile(mapClosingPrices, holdingsPAndL);

    // let me try to modify any gtt order
    console.log(":: Modifying GTT");
    // i want its price to be 2% less than closing price

    modifyGTTAccToYesterdayClose(GttIds, mapClosingPrices);

    console.log("\n:: All done Gracefully !");
  } catch (error) {
    console.log("ERROR: ", error.message);
  } finally {
    console.log("logged out!");
    await smart_api.logout(process.env.clientId);
  }
}

init();
