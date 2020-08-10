import { hot } from 'react-hot-loader';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import React from 'react';
import './App.css';
import Home from './views/Home';
import Summary from './views/Summary';
import DataStoreContext from './datastore';

const App = () => {
  return (
    <Router>
      <div className="App">
        <h1>Provisioning Simulation Visualizer</h1>
        <Switch>
          <Route path="/summary">
            <Summary />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </Router>
  );
};

export default hot(module)(App);
