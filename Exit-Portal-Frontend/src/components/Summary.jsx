import React from "react";
import "./Styles/dashboard.css";
import PdfDownloadButton from "./PdfDownloadButton";
const Summary = ({ data, StudentId }) => {
  // console.log(data);
  return (
    <div className='summary'>
        <PdfDownloadButton studentId={StudentId} />
    </div>
  );
};

export default Summary;
