const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs"); // Import fs
const cors = require("cors"); // Import CORS
const app = express(); // Initialize Express
const port = 3000;
const { ParkingSpot, Street } = require("./dataClasses");

app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON

// Initialize Firebase Admin SDK
const serviceAccount = require("./privatekeyFirebase.json"); // Replace with your service account key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Initialize Firestore

// POST request to upload parking spots from JSON file to Firestore
app.post("/uploadParkingspots", async (req, res) => {
  try {
    const data = fs.readFileSync("parkingSpots.json", "utf8");
    const parkingData = JSON.parse(data);
    const batch = db.batch();

    parkingData.Street.forEach((streetData) => {
      const streetName = streetData.name; // Get street name
      console.log(streetName);

      // Upload southern parking spots
      if (streetData.southernParkingspots) {
        streetData.southernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("southern")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }

      // Upload northern parking spots
      if (streetData.northernParkingspots) {
        streetData.northernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("northern")
            .collection("parkingspots");
          const docRef = collectionRef.doc();
          batch.set(docRef, spotData);
        });
      }

      // Upload eastern parking spots
      if (streetData.easternParkingspots) {
        streetData.easternParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("eastern")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }

      // Upload western parking spots
      if (streetData.westernParkingspots) {
        streetData.westernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("western")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }
    });

    await batch.commit(); // Commit batch write
    res.status(200).send("Parking spots uploaded successfully.");
  } catch (error) {
    console.error("Error uploading parking spots:", error);
    res.status(500).send("Error uploading parking spots.");
  }
});

app.get("/getParkingspots", async (req, res) => {
  try {
    const collections = await db.listCollections();
    let parkingSpots = {};

    for (const collectionRef of collections) {
      const streetName = collectionRef.id; // Street name as collection ID
      let streetData = {
        southernParkingspots: [],
        northernParkingspots: [],
        easternParkingspots: [],
        westernParkingspots: [],
      };

      // Fetch southern parking spots
      const southernDocRef = db.collection(streetName).doc("southern");
      const southernSnapshot = await southernDocRef
        .collection("parkingspots")
        .get();

      if (!southernSnapshot.empty) {
        southernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.southernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch northern parking spots
      const northernDocRef = db.collection(streetName).doc("northern");
      const northernSnapshot = await northernDocRef
        .collection("parkingspots")
        .get();

      if (!northernSnapshot.empty) {
        northernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.northernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch eastern parking spots
      const easternDocRef = db.collection(streetName).doc("eastern");
      const easternSnapshot = await easternDocRef
        .collection("parkingspots")
        .get();

      if (!easternSnapshot.empty) {
        easternSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.easternParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch western parking spots
      const westernDocRef = db.collection(streetName).doc("western");
      const westernSnapshot = await westernDocRef
        .collection("parkingspots")
        .get();

      if (!westernSnapshot.empty) {
        westernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.westernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      parkingSpots[streetName] = streetData; // Store data per street
    }

    console.log(parkingSpots);
    res.json(parkingSpots);
  } catch (error) {
    console.error("Error fetching parking spots:", error);
    res.status(500).json({ error: "Failed to retrieve parking spots" });
  }
});

app.post("/updateSingleParkingspot", async (req, res) => {
  try {
    const { street, id } = req.body;

    if (!street || !id) {
      return res.status(400).send("Please provide street name and id.");
    }

    // Query Firestore for the Parking Spot
    const existingParkingspotRef = db
      .collection(street.toLowerCase())
      .where("spotID", "==", parseInt(id));
    const existingParkSnapshot = await existingParkingspotRef.get();

    // Check if the parkingspot exists
    if (existingParkSnapshot.empty) {
      return res.status(404).json({ error: "Parking spot not found." });
    }

    const parkingDoc = existingParkSnapshot.docs[0]; // Get the first matching document
    const parkingSpotRef = parkingDoc.ref; // Get reference to the document
    const currentOccupied = parkingDoc.data().occupied; // Get current occupancy status

    // Create a ParkingSpot instance and update the occupancy status
    const parkingSpot = new ParkingSpot(
      parkingDoc.data().latitude,
      parkingDoc.data().longitude,
      parkingDoc.data().spotID,
      currentOccupied
    );

    const updatedOccupied = ParkingSpot.toggleOccupancy(parkingSpot.occupied); // Toggle occupancy status

    //update Firestore
    await parkingSpotRef.update({ occupied: updatedOccupied });

    //Success send response
    res.json({
      message: "Parking spot updated successfully.",
      occupied: updatedOccupied,
    });
  } catch (error) {
    console.error("Error updating parking spot:", error);
    res.status(500).json({ error: "Failed to update parking spot." });
  }
});

app.post("/calculateTarget", async (req, res) => {
  const { lat1, lng1, lat2, lng2 } = req.body;

  // Validate required fields
  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const targetResult = calculateTarget(lat1, lng1, lat2, lng2, "Åbogade");

    // Process data
    res.json({
      message: "Should return list of parkingspots in street",
      data: {
        targetResult,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

app.post("/updateMultipleParkingSpots", async (req, res) => {
  const { oldLat, oldLng, newLat, newLng, registeredCars, street } = req.body;
  var candidateCars = [];

  // Validate required fields
  if (!oldLat || !oldLng || !newLat || !newLng || !street || !registeredCars) {
    return res.status(400).json({ error: "Missing required fields" });
  }
   console.log("UpdateMultipleParkingSpots")
   if(oldLat === newLat && oldLng === newLng) {
    console.log("Samme kordinater")
   }
   
  console.log(
    oldLat,
    oldLng,
    newLat,
    newLng,
    registeredCars,
    street.toLowerCase()
  );

  try {
    // Get candidate spots and movement direction
    const { candidateSpots, direction } = await findCandidateSpots(
      oldLat,
      oldLng,
      newLat,
      newLng,
      street.toLowerCase()
    );
    // Convert to ParkingSpot objects
    candidateCars = candidateSpots.map(
      (spot) =>
        new ParkingSpot(
          spot.spotID,
          spot.latitude,
          spot.longitude,
          spot.occupied
        )
    );

    console.log(
      "Candidate parking spots found:",
      candidateCars.map((spot) => spot.spotID)
    );

    if (candidateCars.length > 0) {
      const parkedCars = await compareCandidates(candidateCars, registeredCars);
      // Pass direction to update the correct Firestore subcollection
      updateParkingStatusOfSpots(candidateCars, street, parkedCars, direction);
    }

    // Process data
    res.json({
      message: "Updates multiple spots",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

async function updateParkingStatusOfSpots(
  candidatespots,
  street,
  registeredCars,
  direction
) {
  try {
    console.log("Updating parking status...");
    //console.log("Candidates:", candidatespots);
    //console.log("Registered:", registeredCars);
    console.log("Direction:", direction);

    if (candidatespots.length > 0) {
      await updateSpotsInFirestore(candidatespots, false, street, direction);
      // console.log("candidatespots")
      // console.log(candidatespots)
    }

    if (registeredCars.length > 0) {
      await updateSpotsInFirestore(registeredCars, true, street, direction);
      console.log("registeredCars")
      console.log(registeredCars)
    }

    return { message: "Parking status updated successfully" };
  } catch (error) {
    console.error("Error updating parking spots:", error);
    throw new Error("Failed to update parking spots");
  }
}

async function updateSpotsInFirestore(spots, isOccupied, street, direction) {
  console.log("Updating Firestore for direction:", direction);

  for (const spot of spots) {
    console.log("Processing spot:", spot.spotID);

    const existingParkingspotRef = db
      .collection(street.toLowerCase())
      .doc(direction)
      .collection("parkingspots")
      .where("spotID", "==", parseInt(spot.spotID));

    const existingParkSnapshot = await existingParkingspotRef.get();

    if (existingParkSnapshot.empty) {
      console.error(`Parking spot ${spot.spotID} not found in ${street}/${direction}`);
      continue;
    }

    const parkingDoc = existingParkSnapshot.docs[0];
    const parkingSpotRef = parkingDoc.ref;

    await parkingSpotRef.update({ occupied: isOccupied });

    console.log(`Updated parking spot ${spot.spotID} occupancy to ${isOccupied} in ${direction}`);
  }
}


async function compareCandidates(allCandidates, registeredCars) {
  console.log("compareCandiates");
  console.log(registeredCars);
  var candidates = [];

  registeredCars.forEach((car) => {
    var registeredCarTarget = calculateTarget(
      car.oldLat,
      car.oldLng,
      car.newLat,
      car.newLng
    );

    console.log("registeredCarTarget");
    console.log(registeredCarTarget.targetLat, registeredCarTarget.targetLng);

    let currentClosetestDistance = 10000.0;
    let currentCandidate;
    allCandidates.forEach((candidate) => {
      console.log(candidate);

      var currentDistance = getDistanceFromLatLonInKm(
        registeredCarTarget.targetLat,
        registeredCarTarget.targetLng,
        candidate.latitude,
        candidate.longitude
      );

      //console.log(candidate);
      if (currentDistance < currentClosetestDistance) {
        currentClosetestDistance = currentDistance;
        currentCandidate = candidate;
        //console.log("log" + candidate);
      }
    });
    candidates.push(currentCandidate);
  });
  return candidates;
}

async function findCandidateSpots(oldLat, oldLng, newLat, newLng, street) {
  const candidateSpots = [];

  // Calculate driven distance
  const drivenDistance = getDistanceFromLatLonInKm(
    oldLat,
    oldLng,
    newLat,
    newLng
  );

  // Determine movement direction
  const latDiff = Math.abs(newLat - oldLat); // 1 for positive, -1 for negative
  const lngDiff = Math.abs(newLng - oldLng);

  //Get the overall car direction to decide which collection to query.
  let direction;
  if (latDiff > lngDiff) {
    direction = newLat > oldLat ? "northern" : "southern";
  } else {
    direction = newLng > oldLng ? "eastern" : "western";
  }
  console.log(`Detected movement direction: ${direction}`);

  // Fetch parking spots from Firestore
  const parkingSpotsRef = db
    .collection(street.toLowerCase())
    .doc(direction)
    .collection("parkingspots");
  const parkingSpotsSnapshot = await parkingSpotsRef.get();

  if (parkingSpotsSnapshot.empty) {
    return res.status(404).json({ error: "Parking spot not found." });
  }

  // Check each parking spot
  parkingSpotsSnapshot.forEach((spot) => {
    const spotData = spot.data();
    const distanceToSpot = getDistanceFromLatLonInKm(
      oldLat,
      oldLng,
      spotData.latitude,
      spotData.longitude
    );

    if (distanceToSpot <= drivenDistance) {
      candidateSpots.push(
        new ParkingSpot(
          spotData.spotID,
          spotData.latitude,
          spotData.longitude,
          spotData.occupied
        )
      );
    }
  });

  return { drivenDistance, candidateSpots, direction };
}

// Helper function to check if the spot is in the driven direction
function isSpotInDrivenDirection(
  spot,
  oldLat,
  oldLng,
  latDirection,
  lngDirection
) {
  return (
    Math.sign(spot.latitude - oldLat) === latDirection &&
    Math.sign(spot.longitude - oldLng) === lngDirection
  );
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

//Method to calculate target to be flipped
function calculateTarget(oldLat, oldLng, newLat, newLng, street) {
  const metersToDegreesLat = 1 / 111320;
  const metersToDegreesLng = 1 / (111320 * Math.cos((newLat * Math.PI) / 180));

  const offsetX = -2 * metersToDegreesLng; // 2m to the right
  const offsetY = 2 * metersToDegreesLat; // 2m forward

  // 1. Calculate target coordinates
  // Movement direction
  const deltaLng = newLng - oldLng;
  const deltaLat = newLat - oldLat;
  const movementAngle = Math.atan2(deltaLat, deltaLng);

  // Perpendicular angle
  const perpendicularAngle = movementAngle + Math.PI / 2;
  const offsetPointX = newLng + Math.cos(perpendicularAngle) * offsetX;
  const offsetPointY = newLat + Math.sin(perpendicularAngle) * offsetY;

  // Forward calculations by offset
  const targetLng = offsetPointX + Math.cos(movementAngle) * offsetX;
  const targetLat = offsetPointY + Math.sin(movementAngle) * offsetY;
  console.log("Calculatetarget return: " + targetLng, targetLat);
  return { targetLat, targetLng };
}

//2. Compare target to closets existing spots

//3. Flip exissting spot

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
