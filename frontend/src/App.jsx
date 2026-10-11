import { useEffect, useMemo, useState } from "react";

import {

  ArrowRight,

  Plane,

  MapPin,

  CalendarDays,

  Clock3,

  ShieldCheck,

  Sparkles,

  TrendingUp,

  Activity,

  BrainCircuit,

  TreePine,

  BarChart3,

  Search,

  ChevronDown,

  AlertCircle,

} from "lucide-react";



import "./index.css";





const API_BASE = "https://flightiq-7i44.onrender.com";





function App() {



  // ==========================================================

  // AIRPORT / ROUTE DATA

  // ==========================================================



  const [airports, setAirports] = useState([]);

  const [scope, setScope] = useState(null);



  const [origin, setOrigin] = useState("EWR");

  const [destination, setDestination] = useState("DEN");



  const [originSearch, setOriginSearch] = useState("");

  const [destinationSearch, setDestinationSearch] = useState("");



  const [originOpen, setOriginOpen] = useState(false);

  const [destinationOpen, setDestinationOpen] = useState(false);



  const [supportedDestinations, setSupportedDestinations] = useState([]);



  // ==========================================================

  // FLIGHT FORM

  // ==========================================================



  const [airline, setAirline] = useState(

    "Southwest Airlines Co."

  );



  const [operatingAirline, setOperatingAirline] = useState(

    "WN"

  );



  const [flightDate, setFlightDate] = useState(() => {
    // Use the user's local calendar date as the default.
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  });



  const [departureTime, setDepartureTime] = useState(

    "09:00"

  );



  const [arrivalTime, setArrivalTime] = useState(

    "11:30"

  );



  const [elapsedTime, setElapsedTime] = useState(

    "270"

  );



  // ==========================================================

  // PREDICTION STATE

  // ==========================================================



  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");



  // ==========================================================

  // LOAD AIRPORT DATA

  // ==========================================================



  useEffect(() => {



    fetch(`${API_BASE}/api/airports`)

      .then((response) => response.json())

      .then((data) => {



        if (data.success) {



          setAirports(data.airports || []);

          setScope(data.scope || null);



        }



      })

      .catch(() => {



        setError(

          "Unable to load FlightIQ airport data. "

          + "Please make sure the backend is running."

        );



      });



  }, []);



  // ==========================================================

  // LOAD ROUTES WHEN ORIGIN CHANGES

  // ==========================================================



  useEffect(() => {



    if (!origin) {

      setSupportedDestinations([]);

      return;

    }



    fetch(

      `${API_BASE}/api/routes/${origin}`

    )

      .then((response) => response.json())

      .then((data) => {



        if (data.success) {



          setSupportedDestinations(

            data.destinations || []

          );



        }



      })

      .catch(() => {



        setSupportedDestinations([]);



      });



  }, [origin]);



  // ==========================================================

  // AIRPORT LOOKUP

  // ==========================================================



  const getAirport = (code) => {



    return airports.find(

      (airport) =>

        airport.code === code

    );



  };





  const originAirport = getAirport(origin);

  const destinationAirport = getAirport(destination);





  // ==========================================================

  // FILTER ORIGIN AIRPORTS

  // ==========================================================



  const filteredOrigins = useMemo(() => {



    const search = originSearch

      .trim()

      .toLowerCase();



    if (!search) {

      return airports.slice(0, 80);

    }



    return airports

      .filter((airport) => {



        return (

          airport.code

            .toLowerCase()

            .includes(search) ||



          airport.city

            .toLowerCase()

            .includes(search) ||



          (airport.state || "")

            .toLowerCase()

            .includes(search)

        );



      })

      .slice(0, 80);



  }, [airports, originSearch]);





  // ==========================================================

  // FILTER DESTINATION AIRPORTS

  // ==========================================================



  const filteredDestinations = useMemo(() => {



    const search = destinationSearch

      .trim()

      .toLowerCase();



    const destinationAirports =

      supportedDestinations

        .map((code) => getAirport(code))

        .filter(Boolean);



    if (!search) {



      return destinationAirports.slice(

        0,

        80

      );



    }



    return destinationAirports

      .filter((airport) => {



        return (

          airport.code

            .toLowerCase()

            .includes(search) ||



          airport.city

            .toLowerCase()

            .includes(search) ||



          (airport.state || "")

            .toLowerCase()

            .includes(search)

        );



      })

      .slice(0, 80);



  }, [

    supportedDestinations,

    destinationSearch,

    airports,

  ]);





  // ==========================================================

  // SELECT ORIGIN

  // ==========================================================



  const handleOriginSelect = (airport) => {



    setOrigin(

      airport.code

    );



    setOriginSearch("");



    setOriginOpen(false);



    // Reset destination when origin changes

    setDestination("");

    setDestinationSearch("");

  };





  // ==========================================================

  // SELECT DESTINATION

  // ==========================================================



  const handleDestinationSelect = (

    airport

  ) => {



    setDestination(

      airport.code

    );



    setDestinationSearch("");



    setDestinationOpen(false);



  };





  // ==========================================================

  // TIME CONVERTER

  // ==========================================================



  const timeToHHMM = (time) => {



    if (!time) {

      return 0;

    }



    const [hours, minutes] =

      time.split(":").map(Number);



    return (

      hours * 100 +

      minutes

    );



  };





  // ==========================================================

  // PREDICTION

  // ==========================================================



  const handlePredict = async () => {



    setError("");

    setResult(null);



    if (!origin) {



      setError(

        "Please select an origin airport."

      );



      return;



    }



    if (!destination) {



      setError(

        "Please select a destination airport."

      );



      return;



    }



    if (origin === destination) {
      setError("Please choose two different airports for your route.");
      return;
    }

    if (!flightDate || !departureTime || !arrivalTime) {
      setError("Please enter the flight date, departure time, and arrival time.");
      return;
    }

    if (!Number.isFinite(Number(elapsedTime)) || Number(elapsedTime) <= 0) {
      setError("Please enter a scheduled flight duration greater than zero minutes.");
      return;
    }

    if (!airline.trim() || !operatingAirline.trim()) {
      setError("Please enter the airline name and its operating code.");
      return;
    }

    if (

      !supportedDestinations.includes(

        destination

      )

    ) {



      setError(

        `The route ${origin} → ${destination} `

        + "is not available in the current "

        + "FlightIQ training network."

      );



      return;



    }



    setLoading(true);



    try {



      const response = await fetch(

        `${API_BASE}/api/predict`,

        {

          method: "POST",



          headers: {

            "Content-Type":

              "application/json",

          },



          body: JSON.stringify({



            FlightDate:

              flightDate,



            Airline:

              airline,



            Operating_Airline:

              operatingAirline,



            Marketing_Airline_Network:

              operatingAirline,



            Origin:

              origin,



            Dest:

              destination,



            CRSDepTime:

              timeToHHMM(

                departureTime

              ),



            CRSArrTime:

              timeToHHMM(

                arrivalTime

              ),



            CRSElapsedTime:

              Number(elapsedTime),



          }),

        }

      );



      const data =

        await response.json();



      if (!response.ok) {



        throw new Error(

          data.message ||

          "Prediction request failed."

        );



      }



      setResult(data);



    } catch (err) {



      setError(

        err.message ||

        "Something went wrong while generating the prediction."

      );



    } finally {



      setLoading(false);



    }



  };





  // ==========================================================

  // RESULT DATA

  // ==========================================================



  const prediction =

    result?.prediction || {};



  const riskLevel =

    prediction.risk_level ||

    "Low";



  const delayProbability =

    Number(

      prediction.delay_probability

    ) || 0;



  const expectedDelay =

    Number(

      prediction.expected_delay_minutes

    ) || 0;



  const logisticProbability =

    Number(

      prediction

        .logistic_regression

        ?.delay_probability

    ) || 0;



  const logisticPrediction =

    prediction

      .logistic_regression

      ?.prediction;



  const treeProbability =

    Number(

      prediction

        .decision_tree

        ?.delay_probability

    ) || 0;



  const treePrediction =

    prediction

      .decision_tree

      ?.prediction;





  // ==========================================================

  // DISPLAY HELPERS

  // ==========================================================



  const formatAirport = (

    airport

  ) => {



    if (!airport) {

      return "Select airport";

    }



    return `${airport.code} — ${airport.city}`;



  };





  const riskDescription = {



    High:

      "Higher estimated delay risk. Allow extra time if possible.",



    Medium:

      "Moderate estimated delay risk. Check airline updates before departure.",



    Low:

      "Lower estimated delay risk based on the model. Delays are still possible.",



  }[riskLevel];





  return (



    <div className="app-shell">



      {/* ======================================================

          NAVBAR

      ====================================================== */}



      <nav className="navbar">



        <div className="brand">



          <div className="brand-mark">



            <Plane size={21} />



          </div>



          <div>



            <div className="brand-name">

              FlightIQ

            </div>



            <div className="brand-subtitle">

              Aviation Intelligence

            </div>



          </div>



        </div>





        <div className="nav-status">



          <span className="status-dot"></span>



          AI Prediction Engine



        </div>



      </nav>





      {/* ======================================================

          HERO

      ====================================================== */}



      <main>



        <section className="hero-section">



          <div className="hero-content">



            <div className="eyebrow">



              <Sparkles size={15} />



              PRE-DEPARTURE INTELLIGENCE



            </div>





            <h1>



              Know the risk



              <span>

                before you fly.

              </span>



            </h1>





            <p className="hero-description">



              FlightIQ uses machine learning to estimate

              flight delay probability, expected delay

              duration, and operational risk before

              scheduled departure.



            </p>





            <div className="hero-trust">



              <div>



                <ShieldCheck size={17} />



                <span>

                  ML-powered

                </span>



              </div>



              <div>



                <Activity size={17} />



                <span>

                  Pre-departure prediction

                </span>



              </div>



              <div>



                <BarChart3 size={17} />



                <span>

                  Data-driven insights

                </span>



              </div>



            </div>



          </div>





          {/* Route visual */}



          <div className="hero-route-card">



            <div className="route-card-top">



              <span>

                FLIGHT INTELLIGENCE

              </span>



              <span>

                2022 NETWORK

              </span>



            </div>





            <div className="route-visual">



              <div className="route-point">



                <div className="route-code">

                  {origin || "ORG"}

                </div>



                <div className="route-city">



                  {originAirport?.city ||

                    "Origin airport"}



                </div>



              </div>





              <div className="route-line">



                <div className="route-line-track"></div>



                <Plane size={20} />



              </div>





              <div className="route-point route-point-right">



                <div className="route-code">

                  {destination || "DST"}

                </div>



                <div className="route-city">



                  {destinationAirport?.city ||

                    "Destination"}



                </div>



              </div>



            </div>





            <div className="route-card-bottom">



              <span>

                <CalendarDays size={14} />

                {flightDate}

              </span>



              <span>

                <Clock3 size={14} />

                {departureTime}

              </span>



            </div>



          </div>



        </section>





        {/* ====================================================

            PREDICTION FORM

        ==================================================== */}



        <section className="prediction-section">



          <div className="section-heading">



            <div>



              <div className="section-kicker">

                FLIGHT PROFILE

              </div>



              <h2>

                Check your flight

              </h2>



              <p>

                Enter information available before

                the flight departs.

              </p>



            </div>



            <div className="predeparture-badge">



              <ShieldCheck size={15} />



              No post-departure information used



            </div>



          </div>





          <div className="form-card">





            {/* ==================================================

                ROUTE

            ================================================== */}



            <div className="form-group full-width">



              <label>

                <MapPin size={15} />

                Route

              </label>





              <div className="route-input-grid">





                {/* ORIGIN */}



                <div className="airport-select">



                  <div

                    className="airport-selected"

                    onClick={() =>

                      setOriginOpen(

                        !originOpen

                      )

                    }

                  >



                    <div>



                      <small>

                        FROM

                      </small>



                      <strong>



                        {originAirport

                          ? originAirport.code

                          : "Select"}



                      </strong>



                      <span>



                        {originAirport

                          ? originAirport.city

                          : "Origin airport"}



                      </span>



                    </div>



                    <ChevronDown

                      size={18}

                    />



                  </div>





                  {originOpen && (



                    <div className="airport-dropdown">



                      <div className="airport-search">



                        <Search

                          size={15}

                        />



                        <input

                          autoFocus

                          placeholder="Search airport or city..."

                          value={

                            originSearch

                          }

                          onChange={(e) =>

                            setOriginSearch(

                              e.target.value

                            )

                          }

                        />



                      </div>





                      <div className="airport-options">



                        {filteredOrigins.length === 0 ? (



                          <div className="no-airports">



                            No airports found.



                          </div>



                        ) : (



                          filteredOrigins.map(

                            (airport) => (



                              <button

                                key={

                                  airport.code

                                }

                                type="button"

                                onClick={() =>

                                  handleOriginSelect(

                                    airport

                                  )

                                }

                              >



                                <div>



                                  <strong>

                                    {airport.code}

                                  </strong>



                                  <span>

                                    {airport.city}

                                  </span>



                                </div>



                                <small>

                                  {airport.state}

                                </small>



                              </button>



                            )

                          )



                        )}



                      </div>



                    </div>



                  )}



                </div>





                <div className="route-arrow">



                  <ArrowRight size={20} />



                </div>





                {/* DESTINATION */}



                <div className="airport-select">



                  <div

                    className="airport-selected"

                    onClick={() =>

                      setDestinationOpen(

                        !destinationOpen

                      )

                    }

                  >



                    <div>



                      <small>

                        TO

                      </small>



                      <strong>



                        {destinationAirport

                          ? destinationAirport.code

                          : "Select"}



                      </strong>



                      <span>



                        {destinationAirport

                          ? destinationAirport.city

                          : "Destination"}



                      </span>



                    </div>



                    <ChevronDown

                      size={18}

                    />



                  </div>





                  {destinationOpen && (



                    <div className="airport-dropdown">



                      <div className="airport-search">



                        <Search

                          size={15}

                        />



                        <input

                          autoFocus

                          placeholder="Search destination..."

                          value={

                            destinationSearch

                          }

                          onChange={(e) =>

                            setDestinationSearch(

                              e.target.value

                            )

                          }

                        />



                      </div>





                      <div className="airport-options">



                        {filteredDestinations.length === 0 ? (



                          <div className="no-airports">



                            No supported destinations

                            found for this origin.



                          </div>



                        ) : (



                          filteredDestinations.map(

                            (airport) => (



                              <button

                                key={

                                  airport.code

                                }

                                type="button"

                                onClick={() =>

                                  handleDestinationSelect(

                                    airport

                                  )

                                }

                              >



                                <div>



                                  <strong>

                                    {airport.code}

                                  </strong>



                                  <span>

                                    {airport.city}

                                  </span>



                                </div>



                                <small>

                                  {airport.state}

                                </small>



                              </button>



                            )

                          )



                        )}



                      </div>



                    </div>



                  )}



                </div>



              </div>





              <div className="scope-note">



                <MapPin size={13} />



                {scope?.description ||

                  "FlightIQ currently supports routes represented in its 2022 U.S. flight training network."}



              </div>



            </div>





            {/* ==================================================

                AIRLINE

            ================================================== */}



            <div className="form-group">



              <label>

                <Plane size={15} />

                Airline

              </label>



              <input

                value={airline}

                onChange={(e) =>

                  setAirline(

                    e.target.value

                  )

                }

                placeholder="e.g. Southwest Airlines Co."

              />



            </div>





            {/* ==================================================

                OPERATING AIRLINE

            ================================================== */}



            <div className="form-group">



              <label>

                Operating Airline Code

              </label>



              <input

                value={

                  operatingAirline

                }

                onChange={(e) =>

                  setOperatingAirline(

                    e.target.value.toUpperCase()

                  )

                }

                placeholder="e.g. WN"

                maxLength={4}

              />



            </div>





            {/* ==================================================

                DATE

            ================================================== */}



            <div className="form-group">



              <label>

                <CalendarDays size={15} />

                Flight Date

              </label>



              <input

                type="date"

                value={

                  flightDate

                }

                onChange={(e) =>

                  setFlightDate(

                    e.target.value

                  )

                }

              />



            </div>





            {/* ==================================================

                DEPARTURE

            ================================================== */}



            <div className="form-group">



              <label>

                <Clock3 size={15} />

                Scheduled Departure

              </label>



              <input

                type="time"

                value={

                  departureTime

                }

                onChange={(e) =>

                  setDepartureTime(

                    e.target.value

                  )

                }

              />



            </div>





            {/* ==================================================

                ARRIVAL

            ================================================== */}



            <div className="form-group">



              <label>

                <Clock3 size={15} />

                Scheduled Arrival

              </label>



              <input

                type="time"

                value={

                  arrivalTime

                }

                onChange={(e) =>

                  setArrivalTime(

                    e.target.value

                  )

                }

              />



            </div>





            {/* ==================================================

                ELAPSED TIME

            ================================================== */}



            <div className="form-group">



              <label>

                <Activity size={15} />

                Scheduled Flight Duration (minutes)

              </label>



              <div className="input-with-unit">



                <input

                  type="number"

                  min="1"

                  value={

                    elapsedTime

                  }

                  onChange={(e) =>

                    setElapsedTime(

                      e.target.value

                    )

                  }

                />



                <span>

                  min

                </span>



              </div>

              <p className="scope-note">
                Use the scheduled duration shown by the airline. Departure and arrival
                times are local to their respective airports, so they may not match
                a simple subtraction of the clock times.
              </p>

            </div>





            {/* ==================================================

                ERROR

            ================================================== */}



            {error && (



              <div className="error-message">



                <AlertCircle size={17} />



                <span>

                  {error}

                </span>



              </div>



            )}





            {/* ==================================================

                BUTTON

            ================================================== */}



            <button

              className="predict-button"

              onClick={

                handlePredict

              }

              disabled={loading}

            >



              {loading ? (



                <>

                  <Activity

                    size={18}

                    className="spin"

                  />



                  Analyzing flight...



                </>



              ) : (



                <>

                  <Sparkles size={18} />



                  Estimate My Flight



                  <ArrowRight

                    size={18}

                  />



                </>



              )}



            </button>



          </div>



        </section>





        {/* ====================================================

            RESULTS

        ==================================================== */}



        {result && (
          <section className="results-section" aria-live="polite">
            <div className="section-heading">
              <div>
                <div className="section-kicker">YOUR FLIGHT FORECAST</div>
                <h2>Here’s what FlightIQ estimates</h2>
                <p>
                  A simple estimate based on the flight details you entered and
                  patterns learned from historical flight data.
                </p>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-card primary-result">
                <div className="result-card-icon">
                  <TrendingUp size={20} />
                </div>
                <span className="result-label">CHANCE OF ARRIVAL DELAY</span>
                <div className="result-value">
                  {Math.max(0, Math.min(100, delayProbability)).toFixed(1)}
                  <small>%</small>
                </div>
                <p>
                  Estimated chance that arrival is delayed by 15 minutes or more.
                </p>
              </div>

              <div className="result-card">
                <div className="result-card-icon">
                  <Clock3 size={20} />
                </div>
                <span className="result-label">ESTIMATED DELAY</span>
                <div className="result-value">
                  {Math.max(0, expectedDelay).toFixed(1)}
                  <small> min</small>
                </div>
                <p>
                  Estimated arrival delay in minutes. This is a model estimate,
                  not a guaranteed outcome.
                </p>
              </div>

              <div className={`result-card risk-card risk-${String(riskLevel).toLowerCase()}`}>
                <div className="result-card-icon">
                  <ShieldCheck size={20} />
                </div>
                <span className="result-label">DELAY RISK</span>
                <div className="risk-value">{riskLevel}</div>
                <p>{riskDescription || "Review the estimate and allow extra time where possible."}</p>
              </div>
            </div>

            <div className="insight-grid">
              <div className="insight-card">
                <div className="insight-header">
                  <MapPin size={18} />
                  <span>YOUR ROUTE</span>
                </div>
                <h3>
                  {origin} <ArrowRight size={18} /> {destination}
                </h3>
                <p>
                  {(originAirport?.city || "Origin airport") +
                    " → " +
                    (destinationAirport?.city || "Destination airport")}
                </p>
              </div>

              <div className="insight-card">
                <div className="insight-header">
                  <CalendarDays size={18} />
                  <span>YOUR SCHEDULE</span>
                </div>
                <h3>{flightDate}</h3>
                <p>
                  Scheduled departure at {departureTime}; scheduled arrival at {arrivalTime}.
                </p>
              </div>

              <div className="insight-card">
                <div className="insight-header">
                  <Sparkles size={18} />
                  <span>WHAT SHOULD YOU DO?</span>
                </div>
                <h3>
                  {String(riskLevel).toLowerCase() === "high"
                    ? "Allow extra time"
                    : String(riskLevel).toLowerCase() === "medium"
                    ? "Keep an eye on updates"
                    : "Check your flight before leaving"}
                </h3>
                <p>
                  FlightIQ is a planning aid, not a live airline status service.
                  Always check your airline for the latest flight information.
                </p>
              </div>
            </div>

            <details className="model-section">
              <summary className="model-section-header">
                <div>
                  <div className="section-kicker">FOR PROJECT REVIEW</div>
                  <h3>Technical model details</h3>
                  <p>
                    Expand this section to see the three algorithms used in this
                    academic project.
                  </p>
                </div>
                <ChevronDown size={20} />
              </summary>

              <div className="model-grid">
                <div className="model-card">
                  <div className="model-icon">
                    <BrainCircuit size={20} />
                  </div>
                  <div className="model-title">Logistic Regression</div>
                  <div className="model-probability">
                    {logisticProbability.toFixed(1)}%
                  </div>
                  <div className="model-status">
                    Estimated probability of arrival delay
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(0, Math.min(logisticProbability, 100))}%`,
                      }}
                    />
                  </div>
                  <p className="model-status">
                    Threshold-based class: {logisticPrediction === 1 ? "Delay" : "No delay"}
                  </p>
                </div>

                <div className="model-card">
                  <div className="model-icon">
                    <TreePine size={20} />
                  </div>
                  <div className="model-title">Decision Tree</div>
                  <div className="model-probability">
                    {treeProbability.toFixed(1)}%
                  </div>
                  <div className="model-status">
                    Estimated probability of arrival delay
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(0, Math.min(treeProbability, 100))}%`,
                      }}
                    />
                  </div>
                  <p className="model-status">
                    Threshold-based class: {treePrediction === 1 ? "Delay" : "No delay"}
                  </p>
                </div>

                <div className="model-card">
                  <div className="model-icon">
                    <BarChart3 size={20} />
                  </div>
                  <div className="model-title">Linear Regression</div>
                  <div className="model-probability">
                    {Math.max(0, expectedDelay).toFixed(1)}
                    <small> min</small>
                  </div>
                  <div className="model-status">
                    Estimated arrival delay duration
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(0, Math.min(expectedDelay, 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </details>

            <p className="scope-note">
              Important: You can estimate a flight scheduled for today or another selected date.
              FlightIQ uses patterns learned from 2022 U.S. flight data; it does not check live
              airline status, weather, or airport conditions and has not been validated for Indian routes.
            </p>
          </section>
        )}

      </main>





      {/* ======================================================

          FOOTER

      ====================================================== */}



      <footer className="footer">



        <div>



          <strong>

            FlightIQ

          </strong>



          <span>

            Intelligent Flight Delay &

            Operational Risk Prediction

          </span>



        </div>



        <span>

          Academic ML Capstone · 2022 U.S. Flight Network

        </span>



      </footer>



    </div>



  );



}





export default App;