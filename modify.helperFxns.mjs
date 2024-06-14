import {
  computeQuantityPortfolioSpecific,
  computeQuantity,
  getMyBuyingAveragePrice,
  getClosingPrice,
  roundOffTriggerPrice,
} from "./getOrCompute.helperFxns.mjs";
import {
  GttIds,
  percentMappings,
  tokensMap,
  ChalkSuccess,
  ChalkError,
  ChalkWarning,
  smart_api,
} from "./config.mjs";

export function modifyGtt(
  gttID,
  scriptName,
  percentFromPreviousClose,
  mapClosingPrices,
  fetchedGtts
) {
  try {
    const closingPrice = getClosingPrice(scriptName, mapClosingPrices);

    // x% from yesterday close
    const xPercent = percentFromPreviousClose / 100;
    const limitPrice = Number(
      (closingPrice - closingPrice * xPercent).toFixed(2)
    );

    const triggerPrice = roundOffTriggerPrice(limitPrice + 0.01);
    // now i want to make sure that trigger price be either .05 or .00 whole number

    const quantity = computeQuantity(scriptName, limitPrice, xPercent);

    console.log(
      `script: ${scriptName} closingPrice: ${closingPrice}, limitPrice: ${limitPrice}, triggerPrice:${triggerPrice}, quantity: ${quantity}`
    );

    const orderDetail = {
      id: gttID,
      symboltoken: tokensMap.get(scriptName),
      exchange: "NSE",
      qty: quantity,
      price: limitPrice,
      triggerprice: triggerPrice,
    };
    // making API Call
    // first let me check is modification actually required?

    let isGttModificationRequired = true;
    try {
      // validating is provided by me in config file valid
      if (!fetchedGtts.has(gttID)) {
        throw new Error(`${gttID} is invalid, kindly check config file!`);
      }

      let fetchedGtt = fetchedGtts.get(gttID);
      // console.log(fetchedGtt);
      if (
        fetchedGtt.qty === orderDetail.qty &&
        fetchedGtt.triggerprice === orderDetail.triggerprice &&
        fetchedGtt.price === orderDetail.price
      ) {
        isGttModificationRequired = false;
      }
    } catch (error) {
      console.log(ChalkError(error.message));
      throw error;
    }

    if (isGttModificationRequired) {
      if (process.env.isAllowedToModifyGTTOrders === "true") {
        console.log(".env file allowed to modify GTT!");

        modifyGttOrder(orderDetail);
      } else {
        console.log(ChalkWarning("Not allowed to modify GTT, check .env!"));
      }
    } else {
      console.log(ChalkSuccess("GTT modification not required! (skipping)"));
    }
  } catch (error) {
    // console.log(error);
    throw new Error("Failed to modify GTT, ", error.message || "");
  }
}

export function modifyGttAccToPortfolio(
  gttID,
  scriptName,
  percentFromPortfolio,
  mapMyBuyingAveragePrice,
  fetchedGtts,
  holdingsPAndL
) {
  try {
    const myBuyingAveragePrice = getMyBuyingAveragePrice(
      scriptName,
      mapMyBuyingAveragePrice
    );

    // x% from portfolio close
    const xPercent = percentFromPortfolio / 100;
    const limitPrice = Number(
      (myBuyingAveragePrice - myBuyingAveragePrice * xPercent).toFixed(2)
    );

    const triggerPrice = roundOffTriggerPrice(limitPrice + 0.01);
    // now i want to make sure that trigger price be either .05 or .00 whole number

    const quantity = computeQuantityPortfolioSpecific(
      scriptName,
      limitPrice,
      xPercent,
      holdingsPAndL
    );

    console.log(
      `script: ${scriptName}, myBuyingAveragePrice: ${myBuyingAveragePrice}, limitPrice: ${limitPrice}, triggerPrice:${triggerPrice}, quantity: ${quantity}`
    );

    const orderDetail = {
      id: gttID,
      symboltoken: tokensMap.get(scriptName),
      exchange: "NSE",
      qty: quantity,
      price: limitPrice,
      triggerprice: triggerPrice,
    };
    console.log(orderDetail);
    // making API Call
    // first let me check is modification actually required?

    let isGttModificationRequired = true;
    try {
      // validating is provided by me in config file valid
      if (!fetchedGtts.has(gttID)) {
        throw new Error(`${gttID} is invalid, kindly check config file!`);
      }

      let fetchedGtt = fetchedGtts.get(gttID);
      // console.log(fetchedGtt);
      if (
        fetchedGtt.qty === orderDetail.qty &&
        fetchedGtt.triggerprice === orderDetail.triggerprice &&
        fetchedGtt.price === orderDetail.price
      ) {
        isGttModificationRequired = false;
      }
    } catch (error) {
      console.log(ChalkError(error.message));
      throw error;
    }

    if (isGttModificationRequired) {
      if (process.env.isAllowedToModifyGTTOrders === "true") {
        console.log(".env file allowed to modify GTT!");

        modifyGttOrder(orderDetail);
      } else {
        console.log(ChalkWarning("Not allowed to modify GTT, check .env!"));
      }
    } else {
      console.log(ChalkSuccess("GTT modification not required! (skipping)"));
    }
  } catch (error) {
    // console.log(error);
    throw new Error("Failed to modify GTT, ", error.message);
  }
}

export async function modifyGttOrder(orderDetail) {
  console.log("Modifying GTT ORDER !");
  console.log(orderDetail);

  await smart_api.modifyRule(orderDetail);
}

export async function modifyGTTAccToYesterdayClose(
  mapClosingPrices,
  fetchedGtts
) {
  return new Promise((resolve, reject) => {
    console.log(":: Modifying GTT according to Yesterday Close");
    let timeout = 1000;
    let promises = [];
    Object.entries(GttIds.yesterdayClose).forEach(([howMuchPercent, obj]) => {
      Object.entries(obj).forEach(([script, gttID]) => {
        if (gttID) {
          let promise = new Promise((resolve, reject) => {
            setTimeout(() => {
              console.log(`\n:: Processing ${howMuchPercent}`);
              console.log(`:: ${script}: ${gttID}`);
              console.log(":: API req made to modify gtt!");
              try {
                modifyGtt(
                  gttID,
                  script,
                  percentMappings.get(howMuchPercent),
                  mapClosingPrices,
                  fetchedGtts
                );
                resolve();
              } catch (error) {
                resolve();
                // reject(error);
              }
            }, timeout);
          });

          promises.push(promise);
          timeout += Number(process.env.timeOutDelayBetweenModifyGttReq);
          // now i want to get the yesterday closing price of current script
        }
      });
      // console.log(obj)
    });
    Promise.all(promises)
      .then(() => {
        resolve("processing completed!");
      })
      .catch((err) => {
        reject(err);
      });
    // resolve("processing completed!");
  });
}

export async function modifyGTTAccToPortfolio5Percent(
  mapMyBuyingAveragePrice,
  fetchedGtts,
  holdingsPAndL
) {
  return new Promise((resolve, reject) => {
    console.log(mapMyBuyingAveragePrice);
    console.log(":: Modifying GTT according to Portfolio");
    let timeout = 1000;
    let promises = [];
    Object.entries(GttIds.portfolio).forEach(([howMuchPercent, obj]) => {
      Object.entries(obj).forEach(([script, gttID]) => {
        if (gttID) {
          let promise = new Promise((resolve, reject) => {
            setTimeout(() => {
              console.log(`\n:: Processing ${howMuchPercent}`);
              console.log(`:: ${script}: ${gttID}`);
              console.log(":: API req made to modify gtt!");
              try {
                modifyGttAccToPortfolio(
                  gttID,
                  script,
                  percentMappings.get(howMuchPercent),
                  mapMyBuyingAveragePrice,
                  fetchedGtts,
                  holdingsPAndL
                );
                resolve();
              } catch (error) {
                resolve();
                // reject(error);
              }
            }, timeout);
          });

          promises.push(promise);
          timeout += Number(process.env.timeOutDelayBetweenModifyGttReq);
          // now i want to get the yesterday closing price of current script
        }
      });
      // console.log(obj)
    });
    Promise.all(promises)
      .then(() => {
        resolve("processing completed!");
      })
      .catch((err) => {
        reject(err);
      });
    // resolve("processing completed!");
  });
}
