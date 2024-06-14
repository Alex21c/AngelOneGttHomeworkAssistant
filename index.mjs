import "dotenv/config";
import { authenticator } from "otplib";

import { initializeTheClosingPriceOfAllScripts } from "./getOrCompute.helperFxns.mjs";
import {
  scriptsFormalNames,
  ChalkSuccess,
  ChalkError,
  ChalkWarning,
  smart_api,
} from "./config.mjs";

import {
  modifyGTTAccToYesterdayClose,
  modifyGTTAccToPortfolio5Percent,
} from "./modify.helperFxns.mjs";
import {
  fetchActiveGTTs,
  fetchHoldings,
  fetchOverallGainLoss,
  fetchMyBuyingAvergePrice,
} from "./fetch.helperFxns.mjs";
import {
  storeFetchedGttsIntoJsonFile,
  saveIntoExcelFile,
} from "./fileStorage.helperFxns.mjs";

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
    const fetchedGtts = await fetchActiveGTTs();

    storeFetchedGttsIntoJsonFile(fetchedGtts);

    // fetching holding
    const holdings = await fetchHoldings();

    const holdingsPAndL = fetchOverallGainLoss(holdings, scriptsFormalNames);
    // console.log(holdingsPAndL);

    // fetch my buying average price
    const mapMyBuyingAveragePrice = fetchMyBuyingAvergePrice(
      holdings,
      scriptsFormalNames
    );

    // Getting closing prices
    console.log(":: Fetching Closing Prices");
    const mapClosingPrices = await initializeTheClosingPriceOfAllScripts();
    // console.log(mapClosingPrices);

    // saving into excel file
    await saveIntoExcelFile(
      mapMyBuyingAveragePrice,
      mapClosingPrices,
      holdingsPAndL
    );

    // let me try to modify any gtt order
    console.log(":: Modifying GTT");
    await modifyGTTAccToYesterdayClose(mapClosingPrices, fetchedGtts);

    await modifyGTTAccToPortfolio5Percent(
      mapMyBuyingAveragePrice,
      fetchedGtts,
      holdingsPAndL
    );

    console.log("\n:: All done Gracefully !");
  } catch (error) {
    // console.log(error);
    console.log(ChalkError("ERROR: ", error.message));
  } finally {
    console.log("logged out!");
    await smart_api.logout(process.env.clientId);
  }
}

init();
