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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${config.backendUrl}/api/v1/frontend/generatereport`,
        { universityId: studentId }
      );
      data.categoryProgress = data.categoryProgress.reverse();
      data.categories = data.categories.reverse();
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
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
  
    // Layout Constants
    const OUTER_MARGIN = 36;
    const CARD_MARGIN_Y = 22;
    const CARD_WIDTH = pageW - OUTER_MARGIN * 2;
    const CARD_X = OUTER_MARGIN;
    const START_Y = 92;
  
    // --- TOP HEADING ---
    doc.setFontSize(20).setFont('helvetica', 'bold').setTextColor(128, 0, 0);
    doc.text('Exit Requirements Report', pageW / 2, 48, { align: 'center' });
  
    // --- STUDENT INFO CARD (with visual white space) ---
    const infoCardH = 62;
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(232, 232, 232);
    doc.roundedRect(CARD_X, 56, CARD_WIDTH, infoCardH, 12, 12, "FD");
  
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(65, 65, 65);
    let infoY = 78;
    doc.text('Student ID:', CARD_X + 20, infoY);
    doc.text('Student Name:', CARD_X + CARD_WIDTH / 2 + 10, infoY);
  
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(40, 40, 40);
    doc.text(reportData.studentId, CARD_X + 85, infoY);
    doc.text(reportData.studentName, CARD_X + CARD_WIDTH / 2 + 91, infoY);
  
    infoY += 24;
    doc.setFont('helvetica', 'bold').setTextColor(65, 65, 65);
    doc.text('Total Completed Courses:', CARD_X + 20, infoY);
    doc.text('Total Completed Credits:', CARD_X + CARD_WIDTH / 2 + 10, infoY);
  
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    const totalCompletedCourses = (reportData.categories || []).reduce((sum, c) => sum + (c.completedCourses || 0), 0);
    const totalCompletedCredits = (reportData.categories || []).reduce((sum, c) => sum + (c.completedCredits || 0), 0);
    doc.text(String(totalCompletedCourses), CARD_X + 165, infoY);
    doc.text(String(totalCompletedCredits), CARD_X + CARD_WIDTH / 2 + 145, infoY);
  
    let curY = 56 + infoCardH + 28; // ample space before summary table
    
    // --- CATEGORY PROGRESS SUMMARY TABLE ---
    try {
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(128, 0, 0);
      doc.text('Category Progress Summary', CARD_X + 18, curY);
      doc.autoTable({
        startY: curY + 10,
        margin: { left: CARD_X + 14 },
        tableWidth: CARD_WIDTH - 28,
        styles: { fontSize: 8.6, cellPadding: 3.4, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 245, 245] },
        columnStyles: { 0: { halign: 'left' } },
        head: [[
          'Category', 'Req Courses', 'Req Credits', 'Reg Courses', 'Reg Credits', 'Done Courses', 'Done Credits'
        ]],
        body: (reportData.categoryProgress ?? []).length > 0
          ? (reportData.categoryProgress ?? []).map(cp => [
              cp.categoryName ?? '-',
              String(cp.minRequiredCourses ?? '-'),
              String(cp.minRequiredCredits ?? '-'),
              String(cp.registeredCourses ?? '-'),
              String(cp.registeredCredits ?? '-'),
              String(cp.completedCourses ?? '-'),
              String(cp.completedCredits ?? '-')
            ])
          : [[{ content: 'No category progress data', colSpan: 7, styles: { halign: 'center', fontStyle: 'italic', textColor: [136, 136, 136] } }]],
        theme: 'striped',
      });
      curY = doc.lastAutoTable.finalY + CARD_MARGIN_Y;
    } catch (e) {
      // If the table fails for some reason, continue PDF generation gracefully
      curY += 12;
    }
    
    // Helpers: normalization for year & semester
    const normalizeYear = (y) => String(y ?? '').replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/-+/g, '-');
    const normalizeSem = (s) => {
      const up = String(s ?? '').toUpperCase();
      if (up.includes('ODD')) return 'ODD';
      if (up.includes('EVEN')) return 'EVEN';
      if (up.includes('SUMMER')) return 'SUMMER';
      return up;
    };
    const filterYearNorm = normalizeYear(reportData.filterYear ?? reportData.year ?? '');
    const filterSemNorm = normalizeSem(reportData.filterSemester ?? reportData.semester ?? '');

    // --- CATEGORY CARDS ---
    (reportData.categories ?? []).forEach((cat, idx) => {
      // DATA
      const reqCourses = cat.minRequiredCourses || 0;
      const reqCredits = cat.minRequiredCredits || 0;
      const doneCourses = cat.completedCourses || 0;
      const doneCredits = cat.completedCredits || 0;
      const requirementMet = (doneCourses >= reqCourses) && (doneCredits >= reqCredits);
      // Robust filtering inputs: support filterYear/filterSemester or year/semester at top-level
      const filterYear = filterYearNorm || null;
      const filterSem = filterSemNorm || null;
      const completedRaw = (cat.courses || []);
      const availableRaw = (cat.incompleteCourses || []);
      const completed = completedRaw.filter(c => {
        const cy = normalizeYear(c.year);
        const cs = normalizeSem(c.semester);
        return (!filterYear || cy === String(filterYear)) && (!filterSem || cs === filterSem);
      });
      const available = availableRaw
        .filter(c => {
          const cy = normalizeYear(c.year);
          const cs = normalizeSem(c.semester);
          return (!filterYear || cy === String(filterYear)) && (!filterSem || cs === filterSem);
        })
        .slice();

      // Chronological sort: Year, then Semester (ODD < EVEN < SUMMER), then courseCode
      const SEM_ORDER = { ODD: 1, EVEN: 2, SUMMER: 3 };
      const semKey = s => SEM_ORDER[s] ?? 99;
      const yearKey = y => normalizeYear(y);
      const compareYearSem = (a, b) => {
        const ya = yearKey(a.year);
        const yb = yearKey(b.year);
        if (ya !== yb) return ya.localeCompare(yb);
        const sa = semKey(normalizeSem(a.semester));
        const sb = semKey(normalizeSem(b.semester));
        if (sa !== sb) return sa - sb;
        return (a.courseCode || '').localeCompare(b.courseCode || '');
      };
      completed.sort(compareYearSem);
      available.sort(compareYearSem);
      const remainingCourses = Math.max(0, reqCourses - doneCourses);
      const remainingCredits = Math.max(0, reqCredits - doneCredits);
  
      // Height Estimate
      const completedCount = Math.max(completed.length, 1);
      const availableCount = available.length;
      const summaryH = 24;
      const progressH = 30;
      const descH = 40;
      const completedTableH = 28 + completedCount * 19;
      const availableTableH = (!requirementMet && availableCount > 0) ? (28 + availableCount * 17) : 0;
      const cardH = summaryH + progressH + descH + completedTableH + availableTableH + 60;
  
      // Page break if needed (no new heading!)
      if (curY + cardH > pageH - OUTER_MARGIN - 24) {
        doc.addPage();
        curY = OUTER_MARGIN;
      }
  
      // --- OUTLINE/Background ---
      doc.setDrawColor(128, 0, 0);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(CARD_X, curY, CARD_WIDTH, cardH, 14, 14, 'FD');
  
      // --- CATEGORY HEADER BANNER ---
      doc.setFontSize(13.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
      doc.setFillColor(128, 0, 0);
      doc.roundedRect(CARD_X, curY, CARD_WIDTH, 32, 14, 14, 'F');
      doc.text(cat.categoryName || "-", CARD_X + CARD_WIDTH / 2, curY + 21, { align: 'center' });
  
      // --- SUMMARY ---
      let yCursor = curY + 50;
      doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(48, 48, 48);
      doc.text(
        requirementMet
          ? `All requirements met (${doneCourses} of ${reqCourses} courses, ${doneCredits} of ${reqCredits} credits)`
          : `Completed: ${doneCourses} / ${reqCourses} courses, ${doneCredits} / ${reqCredits} credits`,
        CARD_X + CARD_WIDTH / 2, yCursor, { align: 'center' }
      );
  
      // --- PROGRESS BAR (centered) ---
      yCursor += 14;
      const pc = reqCourses > 0 ? (doneCourses / reqCourses) : 1;
      const percDisplay = reqCourses > 0 ? Math.round(pc*100) : 100;
      // Centered bar
      const barW = CARD_WIDTH - 175, barH = 12;
      const barX = CARD_X + (CARD_WIDTH - barW) / 2, barY = yCursor;
      let barColor = requirementMet ? [35, 142, 35] : [180, 180, 180];
      // Draw BG
      doc.setDrawColor(230,230,230);
      doc.setFillColor(230,230,230);
      doc.roundedRect(barX, barY + 1, barW, barH, 5, 5, 'FD');
      // Draw FG
      doc.setDrawColor(...barColor);
      doc.setFillColor(...barColor);
      doc.roundedRect(barX, barY + 1, Math.max(0.01, barW*pc), barH, 5, 5, 'F');
      // Label
      doc.setFont('helvetica', 'bold').setFontSize(9.3);
      if (requirementMet && percDisplay === 100) {
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(requirementMet ? 35 : 120, requirementMet ? 142 : 120, requirementMet ? 35 : 120);
      }
      doc.text(`${percDisplay}%`, barX + barW/2, barY + 11, { align: 'center' });
      yCursor += barH + 8;
      // --- COMPLETED COURSES TABLE ---
      yCursor += 6;
      doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(128, 0, 0);
      doc.text('Completed Courses', CARD_X + 18, yCursor);
      yCursor += 2;
      doc.autoTable({
        startY: yCursor + 2.5,
        margin: { left: CARD_X + 14, right: CARD_X + CARD_WIDTH - 14 },
        tableWidth: CARD_WIDTH - 28,
        styles: { fontSize: 8.6, cellPadding: 3.6, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [128, 0, 0], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 245, 245] },
        columnStyles: { 1: { halign: 'left' } },
        head: [['Code', 'Name', 'Yr', 'Sem', 'Credits', 'Grade']],
        body: completed.length > 0
          ? completed.map(c => [
              c.courseCode ?? "-",
              c.courseName ?? '-',
              c.year ?? '-',
              c.semester ?? '-',
              c.credits ?? '-',
              (c.grade && String(c.grade).trim() !== '' ? c.grade : 'Registered')
            ])
          : [[{ content: 'No courses completed yet', colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [136, 136, 136] } }]],
        theme: 'striped',
      });
      yCursor = doc.lastAutoTable.finalY + 10;
  
      // --- DESCRIPTION/INFO (BEFORE available courses!) ---
      if (requirementMet) {
        doc.setFillColor(225, 245, 234);
        doc.setTextColor(31, 131, 36);
      } else {
        doc.setFillColor(255, 249, 233);
        doc.setTextColor(194, 100, 6);
      }
      doc.setDrawColor(223, 223, 223);
      doc.roundedRect(CARD_X + 18, yCursor, CARD_WIDTH - 36, 37, 8, 8, "FD");
      doc.setFont('helvetica', 'normal').setFontSize(9.2);
      let infoText = "";
      if (requirementMet) {
        infoText = "All requirements for this section are complete. Well done!";
      } else if (available.length > 0) {
        infoText = `You need to complete ${remainingCourses} more course(s) and ${remainingCredits} more credits from the available list below.`;
      } else {
        infoText = "No available courses left to complete this requirement. Please consult your program coordinator.";
      }
      const textLines = doc.splitTextToSize(infoText, CARD_WIDTH - 64);
      const textHeight = textLines.length * 3.5; // Approximate line height
      const startY = yCursor + (37 - textHeight) / 2 + 3.5; // Center vertically within the box
      doc.text(textLines, CARD_X + (CARD_WIDTH / 2), startY, { align: 'center' });
  
      yCursor += 43;
  
      // --- AVAILABLE COURSES TABLE (now AFTER the info!) ---
      if (!requirementMet && available.length > 0) {
        doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(215, 138, 18);
        doc.text('Available (required) Courses', CARD_X + 18, yCursor + 2);
        doc.autoTable({
          startY: yCursor + 6,
          margin: { left: CARD_X + 14, right: CARD_X + CARD_WIDTH - 14 },
          tableWidth: CARD_WIDTH - 28,
          styles: { fontSize: 8.3, cellPadding: 3.2, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [255, 177, 51], textColor: [34,34,34], fontStyle: 'bold' },
          columnStyles: { 1: { halign: 'left' } },
          head: [['Code','Name','Credits']],
          body: available.map(c => [
            c.courseCode ?? "-", c.courseName ?? "-", c.credits ?? "-"
          ]),
          theme: 'grid'
        });
        yCursor = doc.lastAutoTable.finalY + 8;
      }
  
      // --- END CARD ---
      curY += cardH + CARD_MARGIN_Y;
    });
  
    // --- PAGE FOOTER ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(136, 136, 136);
      doc.text(`Page ${i} of ${totalPages}`, pageW - OUTER_MARGIN, pageH - 18, { align: 'right' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, OUTER_MARGIN, pageH - 18, { align: 'left' });
    }
  
    doc.save(`Exit_Report_${reportData.studentId || 'student'}.pdf`);
  };
  
  
  
  
  
  

  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={generatePDF}
        disabled={loading || !reportData}
        className="bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 shadow-md hover:shadow-lg"
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
