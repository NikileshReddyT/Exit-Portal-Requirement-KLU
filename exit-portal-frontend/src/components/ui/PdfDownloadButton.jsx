// src/components/PdfDownloadButton.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import config from "../../config";
import { FiDownload, FiLoader } from 'react-icons/fi';

const PdfDownloadButton = ({ studentId }) => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (studentId) fetchReportData();
  }, [studentId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${config.backendUrl}/api/v1/frontend/generatereport`,
        { universityId: studentId }
      );
      setReportData(data || null);
    } catch (err) {
      console.error("Failed to fetch report data:", err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF("p", "pt", "a4");
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const brand = '#800000';
    const YEAR_ORDER = y => parseInt(y.split('-')[0], 10);
    const SEM_ORDER = { "Odd Sem": 0, "Even Sem": 1, "Summer Term": 2 };

    let isFirstPage = true;

    // draw header (title only on first page)
    const addHeader = () => {
      if (isFirstPage) {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brand);
        doc.text('Exit Requirements Report', W / 2, 45, { align: 'center' });
        doc.setDrawColor(brand);
        doc.line(40, 55, W - 40, 55);
        isFirstPage = false;
      }
    };

    // draw footer on every page
    const addFooter = () => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#888888');
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${pageCount}`, W / 2, H - 20, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, W - 40, H - 20, { align: 'right' });
      }
    };

    // HEADER
    addHeader();

    // STUDENT INFO + TOTALS (tighter spacing)
    let y = 75;
    doc
      .setFontSize(11)
      .setFont('helvetica', 'bold')
      .setTextColor('#333');
    doc.text('Student Name:', 40, y);
    doc.text('Student ID:', W / 2 + 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(reportData.studentName, 120, y);
    doc.text(reportData.studentId, W / 2 + 80, y);

    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Registered Courses:', 40, y);
    doc.text('Total Registered Credits:', W / 2 + 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(reportData.totalRegisteredCourses), 180, y);
    doc.text(String(reportData.totalRegisteredCredits), W / 2 + 155, y);

    y += 28; // slightly less than before

    // CATEGORIES
    reportData.categories.forEach(cat => {
      // Category heading
      doc
        .setFontSize(14)
        .setFont('helvetica', 'bold')
        .setTextColor(brand);
      doc.text(cat.categoryName, 40, y);
      y += 20;

      // Summary line
      doc
        .setFontSize(10)
        .setFont('helvetica', 'normal')
        .setTextColor('#555');
      const sum = 
        `Req: ${cat.minRequiredCourses} Courses (${cat.minRequiredCredits} Credits)  |  ` +
        `Done: ${cat.registeredCourses} Courses (${cat.registeredCredits} Credits)`;
      doc.text(sum, 40, y);
      y += 20;

      // Table with Year & Semester
      const head = [['Year','Semester','Course Code','Course Name','Credits','Grade']];
      const sorted = (cat.courses || []).slice().sort((a,b) => {
        const yA = YEAR_ORDER(a.year), yB = YEAR_ORDER(b.year);
        if (yA !== yB) return yA - yB;
        return SEM_ORDER[a.semester] - SEM_ORDER[b.semester];
      });
      const body = sorted.map(c => [
        c.year,
        c.semester,
        c.courseCode,
        c.courseName,
        c.credits,
        c.grade
      ]);

      doc.autoTable({
        startY: y,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: brand, textColor: '#fff', fontStyle: 'bold' },
        styles: { cellPadding: 6, fontSize: 9 },
        margin: { left: 40, right: 40 },
        didDrawPage: (data) => {
          // for pages after the first, re-draw the summary header (no title)
          if (!isFirstPage && data.pageNumber > 1 && data.cursor.y === data.settings.margin.top) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(brand);
            doc.text(cat.categoryName, 40, 45);
            doc.setDrawColor(brand);
            doc.line(40, 55, W - 40, 55);
          }
        }
      });

      y = doc.autoTable.previous.finalY + 30;

      // new page if needed
      if (y > H - 100) {
        addFooter();
        doc.addPage();
        addHeader();
        y = 75;
      }
    });

    // FOOTER
    addFooter();
    doc.save(`Exit_Report_${studentId}.pdf`);
  };

  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={generatePDF}
        disabled={loading || !reportData}
        className="bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 shadow-md hover:shadow-lg"
      >
        {loading
          ? <><FiLoader className="animate-spin" /> Loading Report...</>
          : <><FiDownload /> Download PDF</>
        }
      </button>
    </div>
  );
};

export default PdfDownloadButton;
