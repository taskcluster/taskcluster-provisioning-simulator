import React from 'react';
import { Link } from "react-router-dom";
import { hot } from 'react-hot-loader';
import DataStoreContext from '../datastore';

const Summary = () => {
  const ds = React.useContext(DataStoreContext);
  return (
    <>
      Events: {ds.events.length}
      <br />
      Duration: {ds.duration}
    </>
  );
};

export default hot(module)(Summary);
