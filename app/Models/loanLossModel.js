const {
  sendApiResult,
  timeout,
  createExcle,
  generateBlobDownloadURL,
} = require("../controllers/helperController");
const knex = require("../config/database");
const { async } = require("pdfmake/build/pdfmake");
const { select, where } = require("../config/database");
let moment = require("moment");
const lodash = require("lodash");

let loanLoss = function () {};

loanLoss.determindClassificationWiseOutlets = function (req) {
  return new Promise(async (resolve, reject) => {
    try {
      // get all active fi
      const fiList = await knex("cr_fi_institute")
        .where("activation_status", "Active")
        .pluck("id");

      fiList.map(async (fiId) => {
        // get get fi wise dh id
        const fiWiseDhIds = await knex("cr_dh_fi")
          .select("*")
          .where("id_fi", fiId)
          .pluck("id_dh");

        // get get fi wise dh id outlets due credit information
        const getOutletCreditInfos = await knex("cr_credit_disbursements")
          .select(
            "cr_retail_limit.outlet_code",
            "cr_retail_limit.id_outlet",
            "cr_credit_disbursements.paid_amount",
            "cr_credit_disbursements.credit_amount",
            "cr_credit_disbursements.sys_date"
          )
          .innerJoin(
            "cr_retail_limit",
            "cr_credit_disbursements.id_outlet",
            "cr_retail_limit.id_outlet"
          )
          .where("cr_retail_limit.kyc_status", "Approved")
          .where("cr_retail_limit.limit_status", "FI Confirmed")
          .where("cr_retail_limit.activation_status", "Active")
          .where("cr_credit_disbursements.due_amount", ">", "0")
          .whereIn("cr_retail_limit.id_dh", fiWiseDhIds)
          // .whereIn('cr_retail_limit.id_point', [334, 344])
          .groupBy(knex.raw("cr_credit_disbursements.outlet_code ASC"));

        if (getOutletCreditInfos.length > 0) {
          console.log("hello");
          // get classifications
          const fiWiseloanLossClassifications = await knex(
            "cr_outlet_loan_loss_classification"
          )
            .select("*")
            .where("fi_id", fiId)
            .where("active", 1);

          // object declare for prepare insert data
          classificationWiseOutletInformation = [];
          const outletIds = lodash.map(getOutletCreditInfos, "id_outlet");

          let getOutletWiseOutstanding = await outstandingCalculation(
            outletIds
          );

          if (fiWiseloanLossClassifications.length > 0) {
            getOutletCreditInfos.map(async (getOutletCreditInfo) => {
              fiWiseloanLossClassifications.map(async (classification) => {
                // convert range days
                const startDate = moment()
                  .subtract(classification.range_start, "days")
                  .format("YYYY-MM-DD");

                let endDate = moment()
                  .subtract(classification.range_end, "days")
                  .format("YYYY-MM-DD");

                if (classification.range_end === null) {
                  endDate = "2021-03-21";
                }

                const sysDate = moment(getOutletCreditInfo.sys_date).format(
                  "YYYY-MM-DD"
                );

                if (startDate >= sysDate && endDate <= sysDate) {
                  const fromDate = new moment(getOutletCreditInfo.sys_date);
                  const toDate = new moment();
                  const countDays = parseInt(
                    moment.duration(toDate.diff(fromDate)).asDays()
                  );

                  const obj = {
                    id_outlet: getOutletCreditInfo.id_outlet,
                    outlet_code: getOutletCreditInfo.outlet_code,
                    sys_date: moment(new Date()).format("YYYY-MM-DD"),
                    credit_taken_date: sysDate,
                    classification_id: classification.id,
                    start_date: startDate,
                    end_date: endDate,
                    provision_percentage: classification.provision_percentage,
                    outstanding:
                      getOutletWiseOutstanding[getOutletCreditInfo.outlet_code]
                        .total_outstanding,
                    outstanding_with_provision:
                      (getOutletWiseOutstanding[getOutletCreditInfo.outlet_code]
                        .total_outstanding *
                        classification.provision_percentage) /
                      100,
                    days: countDays,
                  };
                  classificationWiseOutletInformation.push(obj);
                }
              });
            });
          }
          await knex("cr_outlet_wise_loan_loss_calculation").insert(
            classificationWiseOutletInformation
          );

          resolve(
            sendApiResult(true, "Outlet wise loan loss classfication done", [])
          );
        }
      });
    } catch (error) {
      reject(sendApiResult(false, error.message));
    }
  });
};

const outstandingCalculation = async function (outletIds) {
  try {
    const currentDate = moment(new Date()).format("YYYY-MM-DD");

    let credit = await knex("cr_credit_disbursements")
      .select(
        "cr_retail_limit.outlet_code",
        knex.raw("SUM(cr_credit_disbursements.credit_amount ) AS total_credit"),
        knex.raw(
          "SUM(cr_credit_disbursements.total_interest_amount ) AS total_interest"
        )
      )
      .innerJoin(
        "cr_retail_limit",
        "cr_retail_limit.id_outlet",
        "cr_credit_disbursements.id_outlet"
      )
      .innerJoin(
        "cr_interest_settings",
        "cr_retail_limit.outlet_code",
        "cr_interest_settings.outlet_code"
      )
      .where("cr_credit_disbursements.sys_date", "<=", currentDate)
      .whereIn("cr_credit_disbursements.id_outlet", outletIds)
      .groupBy("cr_retail_limit.outlet_code")
      .orderBy("cr_retail_limit.outlet_code", "asc");
    let payments = await knex("cr_credit_payments")
      .select(
        "cr_retail_limit.outlet_code",
        knex.raw("SUM(cr_credit_payments.paid_amount ) AS paid_amount"),
        knex.raw("SUM(cr_credit_payments.paid_principle ) AS paid_pric"),
        knex.raw(
          "SUM(cr_credit_payments.paid_interest_amount ) AS paid_interest_amount"
        )
      )
      .innerJoin(
        "cr_retail_limit",
        "cr_retail_limit.id_outlet",
        "cr_credit_payments.id_outlet"
      )
      .where("cr_credit_payments.sys_date", "<=", currentDate)
      .groupBy("cr_retail_limit.outlet_code")
      .whereIn("cr_credit_payments.id_outlet", outletIds)
      .orderBy("cr_retail_limit.outlet_code", "asc");
    const newPayments = lodash.keyBy(payments, "outlet_code");

    arr = [];

    credit = credit.map((creditElement) => {
      let outstadningObject = {};

      const paymentData = newPayments[creditElement.outlet_code];

      outstadningObject.outlet_code = creditElement.outlet_code;

      if (paymentData) {
        outstadningObject.total_outstanding =
          creditElement.total_credit +
          creditElement.total_interest -
          paymentData.paid_amount;
      } else {
        outstadningObject.total_outstanding =
          creditElement.total_credit + creditElement.total_interest - 0;
      }

      return outstadningObject;
    });

    const data = lodash.keyBy(credit, "outlet_code");
    return data;
  } catch (error) {
    return sendApiResult(false, error.message);
  }
};

loanLoss.outletLoanLossData = function (req) {
  return new Promise(async (resolve, reject) => {
    try {
      today = moment().format("YYYY-MM-DD");
      outletLoanLossData = await knex("cr_outlet_wise_loan_loss_calculation")
        .select(
          knex.raw("cr_outlet_wise_loan_loss_calculation.*"),
          "cr_outlet_loan_loss_classification.name"
        )
        .innerJoin(
          "cr_outlet_loan_loss_classification",
          "cr_outlet_loan_loss_classification.id",
          "cr_outlet_wise_loan_loss_calculation.classification_id"
        )
        .innerJoin(
          "cr_retail_limit",
          "cr_retail_limit.id_outlet",
          "cr_outlet_wise_loan_loss_calculation.id_outlet"
        )
        .whereIn("cr_retail_limit.id_point", req.dpids)
        .where("sys_date", today)
        .where("cr_outlet_loan_loss_classification.fi_id", req.fi_id)
        .where(function () {
          if (req.filterText) {
            let search_param = req.filterText.toLowerCase().replace(/\s/g, "");
            this.whereRaw(
              `LOWER(REPLACE(cr_outlet_wise_loan_loss_calculation.outlet_code, ' ', '')) LIKE '%${search_param}%'`
            );
          }
        })
        .where("cr_outlet_wise_loan_loss_calculation.active", 1)
        .orderBy("id_outlet", "asc")
        .paginate({
          perPage: req.per_page,
          currentPage: req.current_page,
          isLengthAware: true,
        });

      if (outletLoanLossData.data.length > 0) {
        outletIds = lodash.map(outletLoanLossData.data, "id_outlet");
        const getoutletsInfo = await outletsInfo(outletIds, req.dpids);

        outletLoanLossData.data.map((outlet) => {
          outlet.region = getoutletsInfo[outlet.id_outlet].region;
          outlet.area = getoutletsInfo[outlet.id_outlet].area;
          outlet.house = getoutletsInfo[outlet.id_outlet].house;
          outlet.territory = getoutletsInfo[outlet.id_outlet].territory;
          outlet.point = getoutletsInfo[outlet.id_outlet].point;
          return outlet;
        });
        resolve(
          sendApiResult(
            true,
            "Outlet wise loan loss classfication done",
            outletLoanLossData
          )
        );
      } else {
        resolve(sendApiResult(true, "No data found", []));
      }
    } catch (error) {
      reject(sendApiResult(false, error.message));
    }
  });
};

const outletsInfo = async function (outletIds, dpIds) {
  try {
    const data = await knex
      .select(
        knex.raw(`distributorspoint.region AS region_id,
                    region.slug AS region,
                    distributorspoint.area AS area_id,
                    area.slug AS area,
                    distributorspoint.dsid AS house_id,
                    company.name AS house,
                    distributorspoint.territory AS territory_id,
                    territory.slug AS territory,
                    distributorspoint.id AS point_id,
                    distributorspoint.name AS point,
                    retail.id_outlet`)
      )
      .from("distributorspoint")
      .innerJoin("company", "distributorspoint.dsid", "company.id")
      .innerJoin(
        { region: "_locations" },
        "distributorspoint.region",
        "region.id"
      )
      .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
      .innerJoin(
        { territory: "_locations" },
        "distributorspoint.territory",
        "territory.id"
      )
      .innerJoin(
        { retail: "cr_retail_limit" },
        "distributorspoint.id",
        "retail.id_point"
      )
      .andWhere("distributorspoint.stts", 1)
      .whereIn("distributorspoint.id", dpIds)
      .whereIn("retail.id_outlet", outletIds);

    return lodash.keyBy(data, "id_outlet");
  } catch (error) {
    return error.message;
  }
};

loanLoss.outletLoanLossReport = function (req) {
  return new Promise(async (resolve, reject) => {
    try {
      today = moment().format("YYYY-MM-DD");
      outletLoanLossData = await knex("cr_outlet_wise_loan_loss_calculation")
        .select(
          knex.raw("cr_outlet_wise_loan_loss_calculation.*"),
          "cr_outlet_loan_loss_classification.name"
        )
        .innerJoin(
          "cr_outlet_loan_loss_classification",
          "cr_outlet_loan_loss_classification.id",
          "cr_outlet_wise_loan_loss_calculation.classification_id"
        )
        .innerJoin(
          "cr_retail_limit",
          "cr_retail_limit.id_outlet",
          "cr_outlet_wise_loan_loss_calculation.id_outlet"
        )
        .whereIn("cr_retail_limit.id_point", req.dpids)
        .where("sys_date", today)
        .where("cr_outlet_loan_loss_classification.fi_id", req.fi_id)
        .where("cr_outlet_wise_loan_loss_calculation.active", 1)
        .where(function () {
          if (req.filterText) {
            let search_param = req.filterText.toLowerCase().replace(/\s/g, "");
            this.whereRaw(
              `LOWER(REPLACE(cr_outlet_wise_loan_loss_calculation.outlet_code, ' ', '')) LIKE '%${search_param}%'`
            );
          }
        })
        .orderBy("id_outlet", "asc");

      if (outletLoanLossData.length > 0) {
        outletIds = lodash.map(outletLoanLossData, "id_outlet");
        const getoutletsInfo = await outletsInfo(outletIds, req.dpids);

        let prepareDataForExcel = [];

        outletLoanLossData.forEach(async (outlet) => {
          let obj = {};
          obj.region = getoutletsInfo[outlet.id_outlet].region;
          obj.area = getoutletsInfo[outlet.id_outlet].area;
          obj.house = getoutletsInfo[outlet.id_outlet].house;
          obj.territory = getoutletsInfo[outlet.id_outlet].territory;
          obj.point = getoutletsInfo[outlet.id_outlet].point;
          obj.outlet_code = outlet.outlet_code;
          obj.sys_date = outlet.sys_date;
          obj.credit_taken_date = outlet.credit_taken_date;
          obj.days = outlet.days;
          obj.name = outlet.name;
          obj.start_date = outlet.start_date;
          obj.end_date = outlet.end_date;
          obj.provision_percentage = outlet.provision_percentage;
          obj.outstanding = outlet.outstanding;
          obj.outstanding_with_provision = outlet.outstanding_with_provision;
          prepareDataForExcel.push(obj);
        });

        let header = [
          { header: "Region", key: "region", width: 11 },
          { header: "Area", key: "area", width: 11 },
          { header: "House", key: "house", width: 36 },
          {
            header: "Territory",
            key: "territory",
            width: 13,
          },
          { header: "Point", key: "point", width: 16 },
          { header: "Outlet Code", key: "outlet_code", width: 13 },
          { header: "Sys date", key: "sys_date", width: 11 },
          {
            header: "Credit Taken Date",
            key: "credit_taken_date",
            width: 16,
          },
          {
            header: 'Days',
            key: 'days',
            width: 10,
          },
          {
            header: "Classification Name",
            key: "name",
            width: 17,
          },
          {
            header: "Start Date",
            key: "start_date",
            width: 11,
          },
          {
            header: "End Date",
            key: "end_date",
            width: 11,
          },
          {
            header: "Provision (%)",
            key: "provision_percentage",
            width: 13,
          },
          {
            header: "Outstanding",
            key: "outstanding",
            width: 12,
          },
          {
            header: "Outstanding With Provision",
            key: "outstanding_with_provision",
            width: 14,
          },
        ];

        const fileName = `eKyc_documents/Loan Loss Outstanding Report (2021-03-22 to ${today}).xlsx`;

        createExcle(
          header,
          process.env.PUBLIC_URL + "" + fileName,
          prepareDataForExcel,
          {
            dataType: {
              provision_percentage: "float",
              outstanding: "float",
              outstanding_with_provision: "float",
            },
          }
        );

        await timeout(3000);
        const url = generateBlobDownloadURL(fileName);

        resolve(sendApiResult(true, "File Generated", url));
      } else {
        reject(sendApiResult(false, "No Outlet Data Found."));
      }
    } catch (error) {
      reject(sendApiResult(false, error.message));
    }
  });
};

loanLoss.summeryOfOutletLoanLossData = function (req) {
  return new Promise(async (resolve, reject) => {
    try {
      today = moment().format("YYYY-MM-DD");
      summeryOfOutletLoanLossData = await knex(
        "cr_outlet_wise_loan_loss_calculation"
      )
        .select(
          "cr_outlet_wise_loan_loss_calculation.classification_id",
          knex.raw(
            "COUNT(cr_outlet_wise_loan_loss_calculation.outlet_code) AS retailer_count"
          ),
          knex.raw(
            "SUM(cr_outlet_wise_loan_loss_calculation.outstanding) AS outstanding"
          ),
          knex.raw(
            "SUM(cr_outlet_wise_loan_loss_calculation.outstanding_with_provision) AS outstanding_with_provision"
          )
        )
        .innerJoin(
          "cr_retail_limit",
          "cr_retail_limit.id_outlet",
          "cr_outlet_wise_loan_loss_calculation.id_outlet"
        )
        .where("sys_date", today)
        .where("cr_outlet_wise_loan_loss_calculation.active", 1)
        .whereIn("cr_retail_limit.id_point", req.dpids)
        .groupBy("cr_outlet_wise_loan_loss_calculation.classification_id")
        .orderBy(
          "cr_outlet_wise_loan_loss_calculation.classification_id",
          "asc"
        )
        .paginate({
          perPage: req.per_page,
          currentPage: req.current_page,
          isLengthAware: true,
        });
      const classifications = await knex(
        "cr_outlet_loan_loss_classification"
      ).where("fi_id", req.fi_id);
      let data = [];
      let classificationWiseData = lodash.keyBy(
        summeryOfOutletLoanLossData.data,
        "classification_id"
      );

      classifications.map((element) => {
        let obj = {};

        if (classificationWiseData[element.id]) {
          obj.name = element.name;
          obj.retailer_count =
            classificationWiseData[element.id].retailer_count;
          obj.modality = element.modality;
          obj.outstanding = classificationWiseData[element.id].outstanding;
          obj.provision_percentage = element.provision_percentage;
          obj.outstanding_with_provision =
            classificationWiseData[element.id].outstanding_with_provision;
          data.push(obj);
        } else {
          obj.name = element.name;
          obj.retailer_count = 0;
          obj.modality = element.modality;
          obj.outstanding = 0;
          obj.provision_percentage = element.provision_percentage;
          obj.outstanding_with_provision = 0;
          data.push(obj);
        }
      });

      resolve(
        sendApiResult(true, "File Generated", {
          data: data,
          pagination: summeryOfOutletLoanLossData.pagination,
        })
      );
    } catch (error) {
      reject(sendApiResult(false, error.message));
    }
  });
};

module.exports = loanLoss;
