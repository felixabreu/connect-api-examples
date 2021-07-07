/**
 * DatePickerHandler handles the action when a new date on the
 * calendar is selected - we show the available times for that date
 */
class DatePickerHandler {
  /**
   * Constructor for DatePickerHandler
   * @param {Object} availabilityMap
   * @param {String} serviceId
   * @param {String} serviceVersion
   * @param {String} staffId
   */
  constructor(availabilityMap, serviceId, serviceVersion, staffId) {
    this.availabilityMap = availabilityMap;
    this.serviceId = serviceId;
    this.serviceVersion = serviceVersion;
    this.staffId = staffId;

    // show the available times for today's date
    const now = new Date();
    this.selectNewDate(new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split("T")[0]);
  }

  /**
   * Handler for when a date is selected on the datepicker widget
   * Show the available times for that date
   * @param {String} date ie. 2021-10-30
   */
  selectNewDate(date) {
    const availableTimesDiv = document.getElementById("available-times");
    // clear available times and reset it to the new available times for the date
    availableTimesDiv.innerHTML = "";
    const availabities = this.availabilityMap[date];
    if (!availabities) { // no available times for the date
      const noTimesAvailable = document.createElement("p");
      noTimesAvailable.className = "no-times-available-msg";
      noTimesAvailable.innerHTML = "There are no times available for this date - please select a new date.";
      availableTimesDiv.appendChild(noTimesAvailable);
      return;
    }
    // for each available time create a new element that directs user to the next page
    availabities.forEach((availability) => {
      const timeItem = document.createElement("a");
      timeItem.innerHTML = availability.time;
      timeItem.href = `/contact?serviceId=${this.serviceId}&version=${this.serviceVersion}&staff=${this.staffId}&startAt=${availability.date}`;
      timeItem.className = "available-time";
      timeItem.type = "submit";
      availableTimesDiv.appendChild(timeItem);
    });
  }
}
