import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const GEO_GRANTED_KEY = "tripzee_geo_granted";

function readStoredGeoGranted() {
    try {
        return localStorage.getItem(GEO_GRANTED_KEY) === "1";
    } catch {
        return false;
    }
}

function writeStoredGeoGranted(granted) {
    try {
        if (granted) localStorage.setItem(GEO_GRANTED_KEY, "1");
        else localStorage.removeItem(GEO_GRANTED_KEY);
    } catch {
        /* ignore quota / private mode */
    }
}

export const CITIES_LIST = [
    "Nagpur",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "Pune",
    "Kolkata",
    "Chennai",
    "Jaipur",
    "Goa",
    "Varanasi",
    "Kochi",
    "Munnar",
    "Manali",
    "Shimla",
    "Srinagar",
    "Udaipur",
    "Jodhpur",
    "Leh",
    "Ahmedabad",
    "Chandigarh",
    "Agra",
    "Amritsar",
    "Rishikesh",
    "Mysuru",
    "Pondicherry",
    "Lucknow",
    "Indore",
];

export const CITY_COORDS = {
    Nagpur: [21.1458, 79.0882],
    Delhi: [28.6139, 77.209],
    Bengaluru: [12.9716, 77.5946],
    Hyderabad: [17.385, 78.4867],
    Mumbai: [19.076, 72.8777],
    Pune: [18.5204, 73.8567],
    Kolkata: [22.5726, 88.3639],
    Chennai: [13.0827, 80.2707],
    Jaipur: [26.9124, 75.7873],
    Goa: [15.4909, 73.8278],
    Varanasi: [25.3176, 82.9739],
    Kochi: [9.9312, 76.2673],
    Munnar: [10.0889, 77.0595],
    Manali: [32.2396, 77.1887],
    Shimla: [31.1048, 77.1734],
    Srinagar: [34.0837, 74.7973],
    Udaipur: [24.5854, 73.7125],
    Jodhpur: [26.2389, 73.0243],
    Leh: [34.1526, 77.5771],
    Ahmedabad: [23.0225, 72.5714],
    Chandigarh: [30.7333, 76.7794],
    Agra: [27.1767, 78.0081],
    Amritsar: [31.634, 74.8723],
    Rishikesh: [30.0869, 78.2676],
    Mysuru: [12.2958, 76.6394],
    Pondicherry: [11.9416, 79.8083],
    Lucknow: [26.8467, 80.9462],
    Indore: [22.7196, 75.8577],
};

function toRad(value) {
    return (value * Math.PI) / 180;
}

export function nearestCity(lat, lng) {
    let bestName = "Nagpur";
    let bestDistance = Infinity;
    for (const [name, coords] of Object.entries(CITY_COORDS)) {
        const [cityLat, cityLng] = coords;
        const dLat = toRad(cityLat - lat);
        const dLng = toRad(cityLng - lng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) * Math.cos(toRad(cityLat)) * Math.sin(dLng / 2) ** 2;
        const distance = 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distance < bestDistance) {
            bestDistance = distance;
            bestName = name;
        }
    }
    return { city: bestName, km: Math.round(bestDistance) };
}

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [currentCity, setCurrentCity] = useState("Nagpur");
    const [geoGranted, setGeoGrantedState] = useState(readStoredGeoGranted);

    const setGeoGranted = useCallback((granted) => {
        setGeoGrantedState(granted);
        writeStoredGeoGranted(granted);
    }, []);

    useEffect(() => {
        if (!navigator.permissions?.query) return undefined;

        let permissionStatus;
        let cancelled = false;

        navigator.permissions
            .query({ name: "geolocation" })
            .then((status) => {
                permissionStatus = status;
                if (cancelled) {
                    status.onchange = null;
                    return;
                }
                if (status.state === "granted") setGeoGranted(true);
                else if (status.state === "denied") setGeoGranted(false);

                status.onchange = () => {
                    if (status.state === "granted") setGeoGranted(true);
                    else if (status.state === "denied") setGeoGranted(false);
                };
            })
            .catch(() => {});

        return () => {
            cancelled = true;
            if (permissionStatus) permissionStatus.onchange = null;
        };
    }, [setGeoGranted]);

    return (
        <LocationContext.Provider value={{ currentCity, setCurrentCity, geoGranted, setGeoGranted }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocationContext = () => useContext(LocationContext);
