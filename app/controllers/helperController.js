"use strict";

const multer = require('multer');
const fs = require("fs");
const fse = require('fs-extra');
const path = require("path");
const AdmZip = require('adm-zip');
const axios = require('axios');
const knex = require('../config/database');
var moment = require('moment');
const { Console } = require('console');
const excel = require('excel4node');
var Exceljs = require('exceljs');

exports.sendApiResult = function (success, message, data = {}) {
  var data = {
    success: success,
    message: message,
    data: data,
  };
  return data;
};

exports.makeRandStr = function (length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

exports.randomIntFromInterval = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

exports.bankApi = async function (params) {
  var output;
  const response = await axios.get(
    'http://localhost:8989/dummy-city-bank',
    {
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjo4MiwibmFtZSI6ImFkbWluIiwiZW1haWwiOiJhYUBiYi5jb20iLCJwaG9uZSI6IjAxODYyNDgyNTMyIiwiY3JfdXNlcl90eXBlIjoiZmkifSwiaWF0IjoxNjExNDYzOTQ5LCJleHAiOjE2MTI0NjM5NDh9.V1Og4xA5fXqfz1iL7M0qf7RJwBMuAbuIYwv3Q0x-VgE",
      },
      params: params
    }
  )
    .then(response => {
      output = response.data;
      // console.log(response);
    })
    .catch(error => {
      // console.log(error);
    });
  return output;
}

exports.uploaddir = process.env.PUBLIC_URL + 'uploads/';

exports.fileUploadConfig = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}uploads/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

exports.scopeOutletUpload = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}scope_outlets/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

exports.bulkKYCApproveUpload = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}kyc_bulk_upload/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

exports.uploadOutletInfo = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}outlet_documents/outlet_nid_info/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

exports.docSubmittedUpload = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}doc_submitted/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};


exports.fileUploadConfigTnx = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}tnx_uploads/`);
    },
    filename: (req, file, cb) => {
      if (typeof file !== undefined) {
        cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
      }
    },
  });
  return storage;
}

exports.fiLogoUpload = function () {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}fi_logos/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
}

exports.uploadRetailerDocsConfig = function (folder_name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const outlet_id = file.originalname.split("_");
      // const path= `./public/${folder_name}/${outlet_id[0]}`;
      // const path = `../../../../../backup/public/${folder_name}/${outlet_id[0]}`;
      const path = `${process.env.PUBLIC_URL}${folder_name}/${outlet_id[0]}`;
      console.log(path);
      fs.mkdirSync(path, { recursive: true })
      cb(null, path);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
  return storage;
}

exports.uploadAccountFormsConfig = function () {

  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const outlet_id = file.originalname.split("_");

      console.log(req.body.names);
      const path = `${process.env.PUBLIC_URL}outlet_documents/`;
      fs.mkdirSync(path, { recursive: true })
      cb(null, path);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
  return storage;
}

exports.uploadBulkFormConfig = function (folder_name) {

  let storage = multer.diskStorage({
    destination: (req, file, cb) => {

      const path = `${process.env.PUBLIC_URL}${folder_name}/`;
      fs.mkdirSync(path, { recursive: true })
      cb(null, path);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
  return storage;
}

exports.saveZip = function (names, initial_location, target_location) {
  try {
    const zip = new AdmZip();
    // const dirname = __dirname + "/../../public/" + initial_location;
    const dirname = process.env.PUBLIC_URL + initial_location;
    const uploaddir = process.env.PUBLIC_URL + target_location;
    // const uploaddir = __dirname + "/../../public/" + target_location;


    names.forEach(e => {
      zip.addLocalFile(dirname + "/" + e);
    });

    const downloadName = `${Date.now()}.zip`;
    zip.writeZip(uploaddir + "/" + downloadName);

    return downloadName;
  } catch (e) {
    console.log(e);
    return false;
  }
}
exports.saveZipFolder = function (folder_name, target_location, file_name) {
  const zip = new AdmZip();
  // const dirname = __dirname + "/../../public/"+folder_name;
  const dirname = process.env.PUBLIC_URL + folder_name;
  const uploaddir = process.env.PUBLIC_URL + target_location;
  zip.addLocalFolder(dirname);
  const downloadName = `${file_name}.zip`;
  zip.writeZip(uploaddir + "/" + downloadName);
  return downloadName;

}
exports.saveZipMultipleFolder = async function (folders, initial_location, target_location, file_name) {
  const zip = new AdmZip();
  // const dirname = __dirname + "/../../public/"+initial_location;
  const dirname = process.env.PUBLIC_URL + initial_location;
  const uploaddir = process.env.PUBLIC_URL + target_location;

  const destDir = dirname + "/tempForBulkZip";

  fse.emptyDirSync(destDir, err => {
    if (err) return console.error(err)
    console.log('tempForBulkZip empty success!')
  });

  for (let i = 0; i < folders.length; i++) {
    const e = folders[i];
    var srcDir = dirname + "/" + e;
    var destOutletDirs = dirname + "/tempForBulkZip/" + e;

    fse.emptyDirSync(destOutletDirs, err => {
      if (err) return console.error(err)
      console.log(e + ' empty success!')
    });
    await fse.copy(srcDir, destOutletDirs, function (err) {
      if (err) {
        console.error(err);
      } else {
        console.log("success!");
      }
    });
  }
  await timeout(1500);
  zip.addLocalFolder(dirname + "/tempForBulkZip");
  const downloadName = file_name == null ? `${Date.now()}.zip` : `${file_name}.zip`;
  zip.writeZip(uploaddir + "/" + downloadName);

  return downloadName;
}

exports.fileUploadInterestSettings = function (name) {
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}interest_settings/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

const timeout = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.timeout = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.downloadFile = function (req, res) {
  const file = `${__dirname}/../../public/` + req.params.dir_name + '/' + req.params.file_name;
  res.download(file); // Set disposition and send it.
}
exports.seeFile = function (req, res) {
  const file = `${__dirname}/../../public/` + req.params.dir_name + '/' + req.params.file_name;
  res.send(file);
}

exports.DynamicFileUploadConfig = function (name) {
  const max = 100;
  let filePath = name;
  let storage = multer.diskStorage({
    destination: (req, file, callBack) => {
      callBack(null, process.env.PUBLIC_URL + 'yearly-sales-file/');
    },
    filename: (req, file, callBack) => {
      callBack(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
}

// exports.OutletCreditInfo = async function (outletId) {
exports.OutletCreditInfo = async function (retailer_id) {

  // **** most important
  // retailer_id = retailers.id;
  // outletId = cr_retail_limit.id_outlet;

  const outlet_info = await knex("retailers")
    .select(
      "cr_retail_limit.id_outlet AS id_outlet"
    )
    .innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code", "retailers.retailer_code")
    .where({ "retailers.id": retailer_id, "retailers.stts": 1 })
    .first();

  if (outlet_info == undefined || Object.keys(outlet_info).length == 0) {
    return {};
  }

  var outletId = outlet_info.id_outlet;

  const credit = await knex.select(knex.raw(`retail.id_outlet,
      retail.outlet_code,
      retail.phone,
	  retail.outlet_name,
      IFNULL(retail.allowed_limit,0) as total_limit,
      IFNULL(retail.daily_limit,0) as daily_limit,
      IFNULL(retail.credit_amount,0) as credit_amount,
      IFNULL(retail.current_balance,0) as current_balance,
      IFNULL(LEAST(retail.current_balance, retail.daily_limit),0) as daily_current_limit,
      IFNULL(retail.total_interest_due,0) as total_interest_due,
      IFNULL(retail.total_due,0) as total_due,
      IFNULL(retail.minimum_due,0) as minimum_due,
      IFNULL(disbursement.paid_amount,0) as paid_amount,
      IFNULL(retail.total_due,0) as due_amount,
      IFNULL(disbursement.cash_payment,0) as cash_payment,
      IFNULL(disbursement.total_interest_amount,0) as total_interest_amount,
      IFNULL(disbursement.total_paid_interest_amount,0) as total_paid_interest_amount,
      IFNULL(retail.carry_amount,0) as carry_amount`))
    .from({ retail: "cr_retail_limit" })
    .leftJoin({ disbursement: "cr_credit_disbursements" }, function () {
      this.on("retail.id_outlet", "=", "disbursement.id_outlet")
      // this.andOnVal("disbursement.activation_status","=","Active")
      this.andOnVal("disbursement.due_amount", "<>", 0)
    })
    .where("retail.id_outlet", outletId)
    .andWhere("retail.activation_status", "Active")
    .andWhere("retail.kyc_status", "Approved")
    .first();

  var daily_credit_limit_ratio = {};
  if (typeof credit !== 'undefined') {
    const section_data = await knex("retailers")
      .select(
        "section_days.saturday",
        "section_days.sunday",
        "section_days.monday",
        "section_days.tuesday",
        "section_days.wednesday",
        "section_days.thursday"
      )
      .join("routes", "retailers.rtid", "routes.id")
      .join("section_days", "routes.section", "section_days.section")
      .where(
        {
          // "retailers.retailer_code": credit.outlet_code,
          "retailers.id": retailer_id,
          "retailers.stts": "1",
          "routes.stts": "1"
        }
      )
      .first();

    var date, dayName, howManyDays = 0;
    var dayDifference = [];
    var weekly_sales_days_count = 0;
    for (var i = 1; i <= 7; i++) {
      date = moment(new Date(), "YYYY-MM-DD").add(i, 'days').format('YYYY-MM-DD');
      dayName = (moment(date).format('dddd')).toLowerCase();
      if (dayName != 'friday') {
        if (section_data[dayName] !== undefined) {
          weekly_sales_days_count += parseInt(section_data[dayName]);
          if (parseInt(section_data[dayName]) == 1) {
            if (Object.keys(dayDifference).length == 0) {
              dayDifference.push(date);
              howManyDays = i;
            }
          }
        }
      }
    }

    daily_credit_limit_ratio = await knex("cr_retailer_daily_credit_config")
      .select("count", "multiply")
      .where(
        {
          "count": weekly_sales_days_count,
          "status": 1,
        }
      ).first();

    // daily_credit_limit_ratio.multiply = 1;
  }

  /*
    var howManyDays = 2;
    if (moment().day() == 3) { // 3 == wednesday
      howManyDays = 3;
    }
  */

  // const disbursements = await knex.select("dwi.*")
  const disbursements = await knex.select(
    "dwi.due_amount",
    "dwi.total_sys_interest_amount",
    "dwi.interest_rate_percentage",
    "dwi.service_charge_rate_percentage",
    "dwi.penalty_rate_percentage",
    "dwi.is_penalty_interest"
  )
    .from({ disb: "cr_credit_disbursements" })
    .join({ dwi: "cr_disbursement_wise_interest" }, function () {
      this.on("disb.id", "=", "dwi.id_cr_credit_disbursement")
      this.andOnVal("dwi.is_current_transaction", "=", 1)
    })
    .where("disb.due_amount", "<>", 0)
    .where("disb.id_outlet", outletId);

  var total_due_amount_after_two_days = 0;
  for (let i = 0; i < disbursements.length; i++) {
    const e = disbursements[i];
    total_due_amount_after_two_days += (Number(e.due_amount) + Number(e.total_sys_interest_amount)) + (Number(e.due_amount) + Number(e.total_sys_interest_amount)) * howManyDays * ((Number(e.interest_rate_percentage) + Number(e.service_charge_rate_percentage) + (Number(e.penalty_rate_percentage) * Number(e.is_penalty_interest))) / 100);
  }

  let outlet_credit = {};

  if (typeof credit !== 'undefined') {
    outlet_credit = {
      id_outlet: credit.id_outlet,
      outlet_code: credit.outlet_code,
      outlet_name: credit.outlet_name,
      outlet_phone: credit.phone,
      cash_payment: parseFloat(credit.cash_payment).toFixed(2),
      total_limit: parseFloat(credit.total_limit).toFixed(2),
      daily_limit: parseFloat(credit.daily_limit * daily_credit_limit_ratio.multiply).toFixed(2),
      current_balance_old: parseFloat(credit.current_balance).toFixed(2),
      daily_current_limit: parseFloat(credit.daily_current_limit * daily_credit_limit_ratio.multiply).toFixed(2),
      current_balance: parseFloat(credit.daily_current_limit * daily_credit_limit_ratio.multiply).toFixed(2),
      total_interest_amount: parseFloat(credit.total_interest_amount).toFixed(2),
      total_interest_due: parseFloat(credit.total_interest_due).toFixed(2),
      total_due_amount_after_two_days: parseFloat(total_due_amount_after_two_days).toFixed(2),
      date_after_two_days: moment(new Date(), "DD-MM-YYYY").add(howManyDays, 'days').format('DD-MMM-YYYY'),
      due_amount: (parseFloat(credit.due_amount) - parseFloat(credit.total_interest_due)).toFixed(2),
      total_due_amount: parseFloat(credit.due_amount).toFixed(2),
      paid_amount: parseFloat(credit.paid_amount).toFixed(2),
      total_paid_interest_amount: parseFloat(credit.total_paid_interest_amount).toFixed(2),
      minimum_due: parseFloat(credit.minimum_due).toFixed(2),
      carry_amount: parseFloat(credit.carry_amount).toFixed(2)
    }
  }
  return outlet_credit;
}

exports.generaeteExcel = function (header, data, fileName, numberCast) {
  var headers = ['SL'];
  var headerKeys = [];
  for (const property in header) {
    headers.push(header[property]);
    headerKeys.push(property);
  }

  var workbook = new excel.Workbook();
  var worksheet = workbook.addWorksheet('Sheet 1');
  var headerStyle = workbook.createStyle({
    fill: {
      type: 'pattern',
      patternType: 'solid',
      bgColor: '#E1F0FF',
      fgColor: '#E1F0FF',
    },
    font: {
      color: "#000000",
      size: "10",
      bold: true
    }
  });
  var col = 1;
  var row = 1;
  var col_add = 0;
  headers.forEach(e => {
    worksheet.cell(row, col + col_add).string(e).style(headerStyle);
    col_add++;
  });
  row++;
  var count = 0;
  for (let i = 0; i < data.length; i++) {
    var col_add = 0;
    const obj = data[i];
    worksheet.cell(row, col + col_add).number(++count); col_add++;
    for (let i = 0; i < headerKeys.length; i++) {
      const element = headerKeys[i];
      if (numberCast.includes(element)) {
        worksheet.cell(row, col + col_add).number(parseFloat(obj[element])); col_add++;
      } else {
        worksheet.cell(row, col + col_add).string("" + obj[element]); col_add++;
      }
    }
    row++;
  }
  workbook.write(`${process.env.PUBLIC_URL}generatedExcelFromDT/` + fileName + `.xlsx`);
  return "generatedExcelFromDT/" + fileName + ".xlsx";
}

exports.asyncGeneraeteExcel = async function (header, data, fileName, numberCast) {
  var headers = ['SL'];
  var headerKeys = [];
  for (const property in header) {
    headers.push(header[property]);
    headerKeys.push(property);
  }

  var workbook = new excel.Workbook();
  var worksheet = workbook.addWorksheet('Sheet 1');
  var headerStyle = workbook.createStyle({
    fill: {
      type: 'pattern',
      patternType: 'solid',
      bgColor: '#E1F0FF',
      fgColor: '#E1F0FF',
    },
    font: {
      color: "#000000",
      size: "10",
      bold: true
    }
  });
  var col = 1;
  var row = 1;
  var col_add = 0;
  headers.forEach(e => {
    worksheet.cell(row, col + col_add).string(e).style(headerStyle);
    col_add++;
  });
  row++;
  var count = 0;
  for (let i = 0; i < data.length; i++) {
    var col_add = 0;
    const obj = data[i];
    worksheet.cell(row, col + col_add).number(++count); col_add++;
    for (let i = 0; i < headerKeys.length; i++) {
      const element = headerKeys[i];
      if (numberCast.includes(element)) {
        worksheet.cell(row, col + col_add).number(parseFloat(obj[element])); col_add++;
      } else {
        worksheet.cell(row, col + col_add).string("" + obj[element]); col_add++;
      }
    }
    row++;
  }
  await workbook.write(`${process.env.PUBLIC_URL}generatedExcelFromDT/` + fileName + '.xlsx');
  console.log(fileName);
  return "generatedExcelFromDT/" + fileName + ".xlsx";
}

exports.getSettingsValue = async (settings_name, settings_group) => {
  const setting = await knex("cr_settings")
    .where((q) => {
      q.where("activation_status", "Active");
      q.where("settings_name", settings_name);
      if (typeof settings_group !== 'undefined') {
        q.where("settings_group", settings_group);
      }
    }).first();
  const value = typeof setting !== 'undefined' ? setting.settings_value : 0;
  return value;
}


exports.fileUploadReviewOldCredit = function (name) {
  const max = 100;
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}review_old_credit/`);
    },
    filename: (req, file, cb) => {
      if (typeof file !== undefined) {
        cb(null, file.originalname);
      }
    },
  });
  return storage;
}

exports.mappedRetailerId = async function (retailer_id) {
  const outlet_info = await knex("retailers")
    .select(
      "cr_retail_limit.id_outlet AS id_outlet"
    )
    .innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code", "retailers.retailer_code")
    .where({ "retailers.id": retailer_id, "retailers.stts": 1 })
    .first();

  if (outlet_info == undefined || Object.keys(outlet_info).length == 0) {
    return null;
  }

  var outletId = outlet_info.id_outlet;
  return outletId;
}
exports.getFiBaseDhids = async (req) => {
  let id_dhs;
  if (req.body.user_type == "bat") {
    id_dhs = await knex("cr_dh_user")
      .select("dh_id")
      .where({
        cr_user_id: req.body.user_id,
      })
      .pluck('dh_id');
  } else {
    id_dhs = await knex("cr_dh_fi")
      .select("id_dh")
      .where({
        id_fi: req.body.fi_id,
        activation_status: "Active"
      })
      .pluck('id_dh');
  }

  return id_dhs;
}

exports.getFiBaseDpids = async (fi_id) => {

  const id_dhs = await knex("cr_dh_fi")
    .select("id_dh")
    .where({
      id_fi: fi_id,
      activation_status: "Active"
    })
    .pluck('id_dh');

  const allDpids = await knex("distributorspoint")
    .select("id")
    .whereIn("dsid", id_dhs)
    .pluck('id');
  return allDpids
}

// Develop by moin

exports.sliceIntoChunks = function (arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}
exports.createExcle = async function (header, fileName, data, options = {}) {

  var workbook_write_stream = new Exceljs.stream.xlsx.WorkbookWriter({
    filename: fileName,
    useStyles: true
  });


  var sheet = workbook_write_stream.addWorksheet('Data');
  sheet.columns = header;
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'cccccc' }
  }
  sheet.getRow('1').border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  sheet.getRow('1').font = {
    name: 'Calibri',
    size: 11,
    bold: true
  };
  sheet.getRow('1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };


  let dataType = options.hasOwnProperty('dataType') ? options.dataType : {};
  console.log(dataType);
  let addSerialNumber = options.hasOwnProperty('addSerialNumber') ? options.addSerialNumber : false;
  console.log(addSerialNumber);

  data.forEach(function (line, key) {

    if (addSerialNumber) {
      line = { 'sn': key + 1, ...line };

    }
    if (Object.keys(dataType).length > 0) {
      line = typeCasting(dataType, line);
    }

    sheet.addRow(Object.values(line)).commit();
    // sheet.getRow(`${key+2}`).alignment = { vertical: 'middle', horizontal: 'center',wrapText: true };

    // sheet.addRow(Object.values(line)).commit();
    // sheet.getRow(`${key+1}`).border = {
    //     top: {style:'thin'},
    //     left: {style:'thin'},
    //     bottom: {style:'thin'},
    //     right: {style:'thin'}
    // };
    // sheet.getRow(`${key+1}`).alignment = { vertical: 'middle', horizontal: 'center',wrapText: true };
  });

  sheet.commit();

  workbook_write_stream.commit()
}

function typeCasting(dataType, mainData) {
  Object.keys(dataType).forEach(columnName => {

    let typeName = dataType[columnName];
    let getData = mainData[columnName];

    switch (typeName) {
      case 'float':
        mainData[columnName] = parseFloat(getData);
        break;
      default:
        break;
    }
  });

  return mainData;
}

exports.getPostCode = (str) => {
  let subString = str.match(/Post Office:(.*?),/i);
  let subString2 = subString !== null ? subString[1].split("-") : [];
  if (subString2 !== null && /\d/.test(subString2[1])) {
    return subString2[1];
  }
}

exports.fileUploadGeneric = function (name) {
  let storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `${process.env.PUBLIC_URL}${name}/`);
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    },
  });
  return storage;
};

exports.generateBlobDownloadURL = function (fileName) {
  return "https://blobstorageprism.blob.core.windows.net/newprism/unnoti/public/" + fileName + "?sv=2021-06-08&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2099-09-01T17:28:53Z&st=2022-09-01T09:28:53Z&spr=https,http&sig=hvPBFj0t2dwExKtoe1ldF7sTOB7kYrpUaK5FqgE6bF0%3D";
}

exports.OutletCreditDetails = async function (retailer_ids, route_id) {
	
	// **** most important
	// retailer_id = retailers.id;
	// outletId = cr_retail_limit.id_outlet;


	// const outlet_info = await knex("retailers")
	// 			.select(
	// 				"cr_retail_limit.id_outlet AS id_outlet"
	// 			)
	// 			.innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code","retailers.retailer_code")
	// 			.whereIn("retailers.id", retailer_ids)
	// 			.where({"retailers.stts": 1}).pluck("id_outlet");
	// 		console.log(outlet_info);
	// if(outlet_info == undefined || Object.keys(outlet_info).length == 0){
	// 	return {};
	// }
	
	const credit = await knex.select(knex.raw(`retail.id_outlet,
      retail.outlet_code,
      retail.phone,
	    retail.outlet_name,
      IFNULL(retail.allowed_limit,0) as total_limit,
      IFNULL(retail.daily_limit,0) as daily_limit,
      IFNULL(retail.credit_amount,0) as credit_amount,
      IFNULL(retail.current_balance,0) as current_balance,
      IFNULL(LEAST(retail.current_balance, retail.daily_limit),0) as daily_current_limit,
      IFNULL(retail.total_interest_due,0) as total_interest_due,
      IFNULL(retail.total_due,0) as total_due,
      IFNULL(retail.minimum_due,0) as minimum_due,
      IFNULL(disbursement.paid_amount,0) as paid_amount,
      IFNULL(retail.total_due,0) as due_amount,
      IFNULL(disbursement.cash_payment,0) as cash_payment,
      IFNULL(disbursement.total_interest_amount,0) as total_interest_amount,
      IFNULL(disbursement.total_paid_interest_amount,0) as total_paid_interest_amount,
      IFNULL(retail.carry_amount,0) as carry_amount`))
    .from({retail:"cr_retail_limit"})
    .leftJoin({disbursement:"cr_credit_disbursements"},function(){
      this.on("retail.id_outlet","=","disbursement.id_outlet")
      this.andOnVal("disbursement.activation_status","=","Active")
      this.andOnVal("disbursement.due_amount","<>",0)
    })
    // .whereIn("retail.id_outlet", outlet_info)
    .whereIn("retail.outlet_code", retailer_ids)
    .andWhere("retail.activation_status", "Active")
    .andWhere("retail.kyc_status", "Approved");
	
	console.log(credit);
	
	var daily_credit_limit_ratio = {};
	if(typeof credit !== 'undefined'){
		
		const section_data = await knex("section_days")
							.select(
									"section_days.saturday",
									"section_days.sunday",
									"section_days.monday",
									"section_days.tuesday",
									"section_days.wednesday",
									"section_days.thursday"
								)
							.innerJoin("routes", "section_days.section", "routes.section")
							.where(
								{
									"routes.id": route_id
								}
							).first();
		
		var date, dayName, howManyDays = 0;
		var dayDifference = [];
		var weekly_sales_days_count = 0;
		for (var i = 1; i <= 7; i++) {
			date = moment(new Date(), "YYYY-MM-DD").add(i, 'days').format('YYYY-MM-DD');
			dayName = (moment(date).format('dddd')).toLowerCase();
			if(dayName != 'friday'){				
				if(section_data[dayName] !== undefined){
					weekly_sales_days_count += parseInt(section_data[dayName]);
					if(parseInt(section_data[dayName]) == 1){
						if(Object.keys(dayDifference).length == 0){
							dayDifference.push(date);
							howManyDays = i;
						}
					}
				}
			}
		}
		
		
		daily_credit_limit_ratio = await knex("cr_retailer_daily_credit_config")
							.select("count", "multiply")
							.where(
								{
									"count": weekly_sales_days_count,
									"status": 1,
								}
							).first();
							
	}
	
	
	const result = [];
	for(let j = 0; j < credit.length; j++){
		const disbursements = await knex.select("dwi.*")
		.from({disb: "cr_credit_disbursements"})
		.join({dwi: "cr_disbursement_wise_interest"}, function(){
		  this.on("disb.id", "=", "dwi.id_cr_credit_disbursement")
		  this.andOnVal("dwi.is_current_transaction","=", 1)
		})
		.where("disb.due_amount","<>",0)
		.where("disb.id_outlet",credit[j].id_outlet);
		
		var total_due_amount_after_two_days = 0;6
		for (let i = 0; i < disbursements.length; i++) {
		  const e = disbursements[i];
		  total_due_amount_after_two_days += (Number(e.due_amount) + Number(e.total_sys_interest_amount)) + (Number(e.due_amount) + Number(e.total_sys_interest_amount)) * howManyDays * ((Number(e.interest_rate_percentage) + Number(e.service_charge_rate_percentage) + (Number(e.penalty_rate_percentage) * Number(e.is_penalty_interest))) / 100);
		}
		
		//console.log(disbursements[j]);
		
		
		// due block
		
		let comparingDay = moment().add(-14, 'days').format('YYYY-MM-DD');

		let data = await knex("cr_credit_disbursements")
			.select("cr_credit_disbursements.due_amount")
			.where("cr_credit_disbursements.due_amount", '>', 0)
			.where("cr_credit_disbursements.sys_date", '<=', comparingDay)
			.where("cr_credit_disbursements.id_outlet", credit[j].id_outlet);
		let due = 0;
	
		if (data != 0) {
			due = data[0].due_amount;
		}
		
		
		let outlet_credit = {};
		
		if(typeof credit[j] !== 'undefined'){
		  outlet_credit = {
			id_outlet:credit[j].id_outlet,
			outlet_code:credit[j].outlet_code,
			outlet_name:credit[j].outlet_name,
			outlet_phone:credit[j].phone,
			cash_payment:parseFloat(credit[j].cash_payment).toFixed(2),
			total_limit:parseFloat(credit[j].total_limit).toFixed(2),
			daily_limit:parseFloat(credit[j].daily_limit * daily_credit_limit_ratio.multiply).toFixed(2),
			current_balance_old:parseFloat(credit[j].current_balance).toFixed(2),
			daily_current_limit:parseFloat(credit[j].daily_current_limit * daily_credit_limit_ratio.multiply).toFixed(2),
			current_balance:parseFloat(credit[j].daily_current_limit * daily_credit_limit_ratio.multiply).toFixed(2),
			total_interest_amount:parseFloat(credit[j].total_interest_amount).toFixed(2),
			total_interest_due:parseFloat(credit[j].total_interest_due).toFixed(2),
			total_due_amount_after_two_days: parseFloat(total_due_amount_after_two_days).toFixed(2),
			date_after_two_days: moment(new Date(), "DD-MM-YYYY").add(howManyDays, 'days').format('DD-MMM-YYYY'),
			due_amount:(parseFloat(credit[j].due_amount) -parseFloat(credit[j].total_interest_due)).toFixed(2),
			total_due_amount: parseFloat(credit[j].due_amount).toFixed(2),
			paid_amount:parseFloat(credit[j].paid_amount).toFixed(2),
			total_paid_interest_amount:parseFloat(credit[j].total_paid_interest_amount).toFixed(2),
			minimum_due:parseFloat(credit[j].minimum_due).toFixed(2),
			carry_amount:parseFloat(credit[j].carry_amount).toFixed(2),
			block_due:parseFloat(due).toFixed(2)
		  }
		}
		
		result.push(outlet_credit);
	}
	
    return result;
	
}