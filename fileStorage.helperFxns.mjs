import fs from "node:fs";
import XLSX from "xlsx";
import { scriptsRealNames } from "./config.mjs";
import { ChalkSuccess, ChalkError, ChalkWarning } from "./config.mjs";

export async function storeFetchedGttsIntoJsonFile(fetchedGtts) {
  try {
    if (process.env.isFetchedGttsStorageIntoJsonFileRequired === "true") {
      console.log("\n:: Saving fetched GTTs into JSON file!");
      // console.log(response.data);
      const fetchedGttsObj = Object.fromEntries(fetchedGtts);
      fs.writeFileSync(
        process.env.jsonFileForStoringActiveFetchedGTTs,
        JSON.stringify(fetchedGttsObj, null, "\t")
      );

      console.log(
        ChalkSuccess(
          `fetched GTTs stored successfully into ${process.env.jsonFileForStoringActiveFetchedGTTs}\n`
        )
      );
    }
  } catch (error) {
    throw error;
  }
}

export async function saveIntoExcelFile(
  mapMyBuyingAveragePrice,
  mapClosingPrices,
  holdingsPAndL
) {
  // let me crate array of array in the format Script, NSE-Close, OverallG/L
  let data = [];
  data.push(["Script", "My Buying Average", "NSE-Close", "OverallG/L"]);
  Object.entries(scriptsRealNames).forEach(([scriptName, value]) => {
    data.push([
      scriptName,
      mapMyBuyingAveragePrice.get(scriptName),
      mapClosingPrices.get(scriptsRealNames[scriptName]),
      holdingsPAndL[scriptName] + "%",
    ]);
  });
  console.log(data);
  if (process.env.isFetchingAndSavingClosingAndPLIntoExcelAllowed === "true") {
    try {
      console.log(":: Saving Closing Prices and Overall G/L into excel file!");
      // wrting to excel file
      var ws = XLSX.utils.aoa_to_sheet(data);
      /* create workbook and export */
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      await XLSX.writeFile(wb, process.env.excelFileNameForStoringPAndL);
      console.log(
        ChalkSuccess(
          `G/L Saved Successfully! into ${process.env.excelFileNameForStoringPAndL}\n`
        )
      );
    } catch (error) {
      throw error;
    }
  }
}
