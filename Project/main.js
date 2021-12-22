//#region Backing Fields

let latitude = 0;
let longitude = 0;
let secondsPerHour = 3600;
let millisecondsPerSecond = 1000;
let divider = 50;
let address;
let marker;
let baseURL = 'http://maps.googleapis.com/maps/api/staticmap?center=laval&zoom=9&maptype=roadmap&size=500x250&scale=2';
let firstLetter;
let apiKey = '&key=AIzaSyB7kIA7meK5zSLTcptvQ84sen10b8k7ArY';
// Used to find the correct time using UTC and not local time
let timeZoneOffset = 5;
let x = '98 avenue Kirkwood, Beaconsfield, QC, Canada';

//#endregion

// Gets the stations and puts them in the dropdown
getLocation();
getStations();

//#region Form
// Sets Current Date Time in the datetime-local input
window.addEventListener("load", function() {
    var now = new Date();
    var utcString = now.toISOString().substring(0,19);
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var localDatetime = year + "-" +
                      (month < 10 ? "0" + month.toString() : month) + "-" +
                      (day < 10 ? "0" + day.toString() : day) + "T" +
                      (hour < 10 ? "0" + hour.toString() : hour) + ":" +
                      (minute < 10 ? "0" + minute.toString() : minute);
    var datetimeField = document.getElementById("time");
    datetimeField.value = localDatetime;
});
// On form submit, gets the two stations and does the things
document.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gets the start station name and id
    let startStation = document.querySelector('#startStation').options[document.querySelector('#startStation').selectedIndex];
    let startStationName = startStation.text;
    let startStationId = startStation.value;

    // Gets the end station name and id
    let endStation = document.querySelector('#endStation').options[document.querySelector('#endStation').selectedIndex];
    let endStationName = endStation.text;
    let endStationId = endStation.value;

    // Uses the names to get the path
    let path = await (await fetch('http://10.101.0.12:8080/path/' + startStationName + '/' + endStationName)).json();
    
    // Gets the date and time the user is leaving or arriving at
    let dateTime = new Date(document.querySelector('#time').value);
    console.log(dateTime);
    
    // Gets the speed of the train
    let speed = await (await fetch('http://10.101.0.12:8080/averageTrainSpeed/')).json();
    speed = speed[0].AverageSpeed;

    let timeline = document.querySelector('#Timeline');
    timeline.innerHTML = '<h2>Timeline</h2>';
    // The path
    for(let i = 0; i < path.length - 1; i++) {
        // Gets the name and id of the station is it at
        let name = path[i].Name;
        let id = path[i].SegmentId;
        let stationId = path[i].StationId;
        console.log(path[i]);

        // Gets the schedule for the station
        let iSchedule = await (await fetch('http://10.101.0.12:8080/schedule/' + name)).json();

        // Gets the next departure time from that station
        let departure = findNextTime(iSchedule, id, dateTime);

        // Displays the timeline
        timeline.innerHTML += '<h4>' + name + '</h4>';
        if(i != 0)
            timeline.innerHTML += 'Arrived at ' + path[i].Name + ' at ' + dateTime + '<br/>';
        timeline.innerHTML += 'Leaving from ' + name + ' at ' + departure + '<br/>';
        scroll();

        // Finds how long the train will take to get to the next station
        secondsToAdd = await findTravelTime(path[i], path[i + 1], speed);            
        timeline.innerHTML += 'Arriving at ' + path[i + 1].Name + ' in ' + secondsToAdd + ' seconds' + '<br/><br/>';
        scroll();

        // Adds the time to the dateTime   
        departure = new Date(departure);

        //Seconds
        totalSeconds = secondsToAdd;
        secondsToSet = secondsToAdd % 60;         
        secondsToAdd = departure.getSeconds() + secondsToSet;

        //Minutes
        totalMinutes = departure.getMinutes() + Math.floor((secondsToAdd+totalSeconds) / 60);
        minutesToSet = totalMinutes % 60;
        
        //Hours
        // The +5 is to offset the timezone
        totalHours = departure.getHours() + timeZoneOffset + Math.floor(totalMinutes / 60);
        hoursToSet = totalHours % 24;
                   
        dateTime.setSeconds(secondsToSet);
        dateTime.setMinutes(minutesToSet);
        dateTime.setHours(hoursToSet);
        
        // Display the information about that station
        await displayStationInfo(stationId);

        // Display the notification at that station
        displayNotification(stationId);
        
        // Gets the first letter of the station name for the marker on the map
        firstLetter = name.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, "");

        // Gets the latitude and longitude of the station from the address
        await getLocation();    
        
        // Makes the marker be the correct location
        marker = '&markers=color:red%7Clabel:' + firstLetter +'%7C' + latitude + ',' + longitude;

        // Displays the map with the marker
        displayLocation();

        // Wait at each station
        await timeBetweenStations(totalSeconds);        
    };   
    timeline.innerHTML += '<h4>' + path[path.length - 1].Name + '</h4>';
    timeline.innerHTML += 'Arrived at ' + path[path.length - 1].Name + ' at ' + dateTime + '<br/>';
    scroll();

    // Display the information about the last station
    await displayStationInfo(path[path.length - 1].StationId);

    // Display the notification at the last station
    displayNotification(path[path.length - 1].StationId);   
    
    // Display the map for the last location
    // Gets the first letter of the station name for the marker on the map
    firstLetter = path[path.length-1].Name.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    // Gets the latitude and longitude of the station from the address
    await getLocation();    
    
    // Makes the marker be the correct location
    marker = '&markers=color:red%7Clabel:' + firstLetter +'%7C' + latitude + ',' + longitude;

    // Displays the map with the marker
    displayLocation();

    // Wait at each station
    await timeBetweenStations(totalSeconds);
});
// Adds the stations names to the dropdown in the form
async function getStations(){
    let stations = await (await fetch('http://10.101.0.12:8080/stations')).json();
    for(let i = 0; i < stations.length; i++){
        // Start Station
        let startStation = document.createElement('option');
        startStation.value = stations[i].StationId;        
        startStation.innerHTML = stations[i].Name;
        document.querySelector('#startStation').add(startStation);
        // End Station
        let endStation = document.createElement('option');
        endStation.value = stations[i].StationId;
        endStation.innerHTML = stations[i].Name;
        document.getElementById('endStation').add(endStation);    
    }
}
//#endregion

//#region Display
// Displays the information about the station
async function displayStationInfo(id){
    let info = await (await fetch('http://10.101.0.12:8080/stations/' + id)).json();
    let station = document.querySelector('#StationInfo');

    // Station Name
    let name = document.createElement('div');

    // Header
    name.innerHTML = '<h2>Station Information</h2>';

    // Spans for true/false
    let t = "<span style='color: green'>True</span>";
    let f = "<span style='color: red'>False</span>";

    // Sets the address for the geo location
    address = info[0].Number + ' ' +  info[0].StreetName + ', ' + info[0].City + ' ' + info[0].Province + ' ' + info[0].Country;

    // Add the information to the station
    name.innerHTML += info[0].Name;    
    name.innerHTML += '<br/> Address : ' + info[0].Number + ' ' +  info[0].StreetName + ', ' + info[0].City + ' ' + info[0].Province + ' ' + info[0].Country;

    // Adds the more info div
    let moreInfo = document.createElement('div');
    moreInfo.id = 'MoreInfo';
    moreInfo.style.display = 'none';
    moreInfo.innerHTML = info[0].AccessibilityFeature == true ? "<br/>Accessibility Features: " + t : "<br/>Accessibility Features: " + f;
    moreInfo.innerHTML += info[0].BicycleAvailability == true ? "<br/>Bicycle Availability: " + t : "<br/>Bicycle Availability: " + f;
    moreInfo.innerHTML += info[0].Elevator == true ? "<br/>Elevator Availability: " + t : "<br/>Elevator Availability: " + f;
    name.appendChild(moreInfo);    

    // Adds the more info button
    name.innerHTML += '<br/><button id="InfoButton" onClick="showMoreInfo(\'#MoreInfo\')">More Info</button>';

    // Adds it to the DOM
    station.innerHTML = name.innerHTML;
}
// Displays the notification at the station
async function displayNotification(id){
    let notification = await (await fetch('http://10.101.0.12:8080/notifications/' + id)).json();
    let notificationDiv = document.querySelector('#StationNotification');
    notificationDiv.innerHTML = '<h2>Station Notification</h2>';
    if(notification.length != 0){   
        for(let i = 0; i < notification.length; i++){ 
            notificationDiv.innerHTML += '<br/> Name: ' + notification[i].Name;
            notificationDiv.innerHTML += '<br/> Description: ' + notification[i].Description;

            let moreInfo = document.createElement('div');
            moreInfo.id = 'MoreNotifInfo';
            moreInfo.style.display = 'none';
            moreInfo.innerHTML = '<br/> Notification Id: ' + notification[i].NotificationId;
            moreInfo.innerHTML = 'Start Station Id:'  + notification[i].StartStationId;
            moreInfo.innerHTML += '<br/> End Station Id:' + notification[i].EndStationId;
            notificationDiv.appendChild(moreInfo);

            notificationDiv.innerHTML += '<br/><button id="NotifButton" onClick="showMoreInfo(\'#MoreNotifInfo\')">More Info</button>';
        }
    }
    else{
        notificationDiv.innerHTML += '<br/>Nothing to report';
    }
}
// Displays the map with the marker
function displayLocation(){
    let map = document.querySelector('#map');
    map.src = baseURL + marker + apiKey;
    console.log(map.src)
}
// Scrolls to the bottom of the timeline
function scroll(){
    let time = document.querySelector('#Timeline');
    time.scrollTop = time.scrollHeight;
}
// Show more info button logic
function showMoreInfo(moreWhat){
    if(moreWhat == '#MoreInfo'){
        let vis = document.querySelector('#MoreInfo').style.display;
        if(vis == 'none') {
            document.querySelector('#InfoButton').innerText = 'Show Less';
            document.querySelector('#MoreInfo').style.display = 'block';
        } else {
            document.querySelector('#InfoButton').innerText = 'Show More';
            document.querySelector('#MoreInfo').style.display = 'none';
        }
    }
    else{
        let vis = document.querySelector('#MoreNotifInfo').style.display;
        if(vis == 'none') {
            document.querySelector('#NotifButton').innerText = 'Show Less';
            document.querySelector('#MoreNotifInfo').style.display = 'block';
        } else {
            document.querySelector('#NotifButton').innerText = 'Show More';
            document.querySelector('#MoreNotifInfo').style.display = 'none';
        }
    }
}
//#endregion

//#region Calculations
// Gets the next train time from the station
function findNextTime(schedule, id, arrival){
    for (let i = 0 ; i < schedule.length; i++){

        // Converts both times to HH:MM:SS (12h)
        // get the time in HH:MM:SS for schedule[i].Time
        let scheduleTime = schedule[i].Time.split('T')[1].split(':');
        let scheduleTimeHours = parseInt(scheduleTime[0]);
        let scheduleTimeMinutes = parseInt(scheduleTime[1]);
        let scheduleTimeSeconds = parseInt(scheduleTime[2]);
        
        // get the time in HH:MM:SS for arrival
        let arrivalTime = arrival.toLocaleTimeString().split(':');
        let arrivalTimeHours = parseInt(arrivalTime[0]);
        let arrivalTimeMinutes = parseInt(arrivalTime[1]);
        let arrivalTimeSeconds = parseInt(arrivalTime[2]);

        // If the schedule time is after the arrival time, it's the next time
        if(schedule[i].SegmentId == id){
            if(scheduleTimeHours > arrivalTimeHours){
                return schedule[i].Time;
            }
            else if(scheduleTimeHours == arrivalTimeHours){
                if(scheduleTimeMinutes > arrivalTimeMinutes){
                    return schedule[i].Time;
                }
                else if(scheduleTimeMinutes == arrivalTimeMinutes){
                    if(scheduleTimeSeconds > arrivalTimeSeconds || scheduleTimeSeconds == arrivalTimeSeconds){
                        return schedule[i].Time;
                    }
                }
            }
        }
    }
}
// Gets the time it takes to get to the next station
async function findTravelTime(startStation, endStation, speed){
    let distance = await (await fetch('http://10.101.0.12:8080/distance/' + encodeURIComponent(startStation.Name) + '/' + encodeURIComponent(endStation.Name))).json();
    return (distance / speed) * secondsPerHour;
}
// for the api, gets the coordinates from the address
async function getLocation() {
    console.log(address);
    let response = await fetch('http://api.positionstack.com/v1/forward?access_key=30de06d4d486065ed537303ed185cc7e&query=' + encodeURIComponent(address));
    let data = await response.json();
    latitude = data.data[0].latitude;
    longitude = data.data[0].longitude;
    console.log('Latitude is ' + latitude + '° Longitude is ' + longitude + '°');
}
//#endregion

//#region Main Functionality
// Simulates the wait at each station
async function timeBetweenStations(seconds){
    return new Promise(resolve => {
        setTimeout(() => {resolve()}, (seconds / divider) * millisecondsPerSecond);
    });
}
//#endregion