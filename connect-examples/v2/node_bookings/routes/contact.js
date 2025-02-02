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

const {
  bookingsApi,
  catalogApi,
} = require("../util/square-client");

/**
 * GET /contact
 *
 * Render the contact information form prior to creating a booking
 *
 *  accepted query params are:
 * `serviceId` - the ID of the service
 * `staffId` - the ID of the staff
 * `startAt` - starting time of the booking
 * `version` - the version of the service initially selected
 */
router.get("/", async (req, res, next) => {
  console.log("entering api for contact");
  const serviceIds = JSON.parse(req.query.serviceItems);
  const staffId = req.query.staff;
  const startAt = req.query.startAt;
  const phoneNumber = req.body.phoneNumber;

  console.log("entering try clause in contact api");

  try {

    // Send request to get the service associated with the given item variation ID, and related objects.
    // const retrieveServicePromise = catalogApi.retrieveCatalogObject(serviceId, true);
    const { result } = await catalogApi.batchRetrieveCatalogObjects({
      objectIds: serviceIds
    });

    const serviceItems = result.objects;
    let depositAmount = 0n;
    serviceItems.forEach(service => {
        depositAmount = depositAmount + service.itemVariationData.priceMoney.amount;
    });

    depositAmount = ((Number(depositAmount)/2)) * .01;
    // // Send request to get the team member profile of the staff selected
    const { result: { teamMemberBookingProfile } } = await bookingsApi.retrieveTeamMemberBookingProfile(staffId);

    // const [ { result: { object : serviceVariation, relatedObjects } }, { result: { teamMemberBookingProfile } } ] = await Promise.all([ retrieveServicePromise, retrieveTeamMemberPromise ]);
    // const serviceItem = relatedObjects.filter(relatedObject => relatedObject.type === "ITEM")[0];

    res.render("pages/contact", { serviceItems, serviceIds, startAt, teamMemberBookingProfile, phoneNumber, depositAmount });
  } catch (error) {
    console.error(error);
    next(error);
  }
});


module.exports = router;
