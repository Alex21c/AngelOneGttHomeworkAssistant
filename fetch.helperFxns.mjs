import { smart_api } from "./config.mjs";
export async function fetchActiveGTTs() {
  try {
    console.log(":: Fetching Active GTTs And Storing Them into File");
    const response = await smart_api.ruleList({
      status: ["NEW"],
      page: 1,
      count: 100,
    });
    if (!response?.data) {
      throw new Error("Failed to fetch GTTs");
    }
    // now creating map out of it
    const mapOfFetchedGtts = new Map();
    response.data.forEach((gtt) => {
      mapOfFetchedGtts.set(gtt.id, gtt);
    });
    return mapOfFetchedGtts;
  } catch (error) {
    throw error;
  }
}
export async function fetchHoldings() {
  try {
    console.log(":: Fetching Holdings");
    let holdings = await smart_api.getHolding();
    if (holdings) {
      holdings = holdings.data;
    } else {
      throw new Error("failed to fetch Holdings");
    }
    return holdings;
  } catch (error) {
    throw error;
  }
}
export function fetchOverallGainLoss(holdings, scriptsFormalNames) {
  try {
    console.log(":: Extracting overall Gain/Loss from Holdings");
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
    // console.log(error);
    throw error;
  }
}

export function fetchMyBuyingAvergePrice(holdings, scriptsFormalNames) {
  try {
    console.log(":: Extracting My Buying Average Price from Holdings");
    // creating simple mapping out of it
    const mappingMyBuyingAveragePrice = new Map();
    holdings.forEach((script) => {
      const scriptFormalName = scriptsFormalNames[script.tradingsymbol];
      if (scriptFormalName !== undefined) {
        mappingMyBuyingAveragePrice.set(scriptFormalName, script.averageprice);
      }
    });

    return mappingMyBuyingAveragePrice;
  } catch (error) {
    throw error;
  }
}
