/*
Copyright 2021 Square Inc.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const express = require("express");
const router = express.Router();
require("dotenv").config();

const locationId = process.env["SQUARE_LOCATION_ID"];

const {
  catalogApi,
} = require("../util/square-client");

/**
 * GET /services
 *
 * This endpoint is in charge of retrieving all of the service items that can be booked for the current location.
 */
router.get("/", async (req, res, next) => {
  const cancel = req.query.cancel;
  try {
    let { result: { items } } = await catalogApi.searchCatalogItems({
      enabledLocationIds: [ locationId ],
      productTypes: [ "APPOINTMENTS_SERVICE" ]
    });

    const { result: { objects } }  = await catalogApi.searchCatalogObjects({
      objectTypes: [
        'CATEGORY'
      ]
    });

    let categories = [];

    if (!items) {
      items = [];
    }
    // console.log(items);
    console.log(objects);

    objects.forEach(category => {
      const categoryName = category.categoryData.name;
      const categoryId = category.id;

      const categoryInfo = {
        name: categoryName,
        id: categoryId,
        items: []
      }

      items.forEach(item => {
        const itemCategoryId = item.itemData.categoryId;

        if (itemCategoryId.localeCompare(categoryId) === 0) {
          categoryInfo.items.push(item);
        }
      })
      categories.push(categoryInfo);
    });


    console.log(categories);

    res.render("pages/select-service", { cancel, items, categories });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

module.exports = router;
