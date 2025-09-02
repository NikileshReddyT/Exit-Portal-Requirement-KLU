package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.*;
import com.jfsd.exit_portal_backend.Repository.*;
import com.opencsv.CSVReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class CombinedImportService {

    @Autowired
    private CategoriesRepository categoriesRepository;

    @Autowired
    private CoursesRepository coursesRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private ProgramCourseCategoryRepository programCourseCategoryRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional
    public List<String> importCombinedCsv(MultipartFile file, String programCode, Double defaultCredits) {
        List<String> messages = new ArrayList<>();
        int createdCategories = 0;
        int updatedCategories = 0;
        int createdCourses = 0;
        int updatedCourses = 0;
        int createdMappings = 0;
        int updatedMappings = 0;

        Double fallbackCredits = defaultCredits != null ? defaultCredits : 0.0;

        // Resolve program
        Optional<Program> programOpt = programRepository.findByCode(programCode);
        if (!programOpt.isPresent()) {
            messages.add("Program not found: " + programCode);
            return messages;
        }
        Program program = programOpt.get();

        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            String[] line;
            // Skip header
            reader.readNext();

            Categories currentCategory = null;
            int row = 1;

            // Collectors for fast batch upserts
            Map<String, String> courseTitles = new HashMap<>();
            Map<String, Double> courseCredits = new HashMap<>();
            Map<String, Integer> courseToCategoryId = new HashMap<>();
            List<int[]> requirementRows = new ArrayList<>(); // [categoryId, minCourses], minCredits handled separately
            List<Double> requirementCredits = new ArrayList<>(); // parallel list for minCredits

            while ((line = reader.readNext()) != null) {
                row++;
                String categoryName  = get(line, 1);
                String minCoursesStr = get(line, 2);
                String minCreditsStr = get(line, 3);
                String courseCode    = get(line, 4);
                String courseTitle   = get(line, 5);
                String creditStr     = get(line, 6);

                boolean isCategoryRow = categoryName != null && !categoryName.isEmpty();

                if (isCategoryRow) {
                    // Find or create category for this program
                    Optional<Categories> existing = categoriesRepository.findByProgramAndCategoryName(program, categoryName);
                    Categories category = existing.orElseGet(Categories::new);
                    if (existing.isPresent()) {
                        updatedCategories++;
                    } else {
                        category.setCategoryName(categoryName);
                        category.setProgram(program);
                        createdCategories++;
                    }

                    currentCategory = categoriesRepository.save(category);

                    // Queue ProgramCategoryRequirement upsert (batch later via native SQL)
                    int minCourses;
                    double minCredits;
                    try {
                        minCourses = (minCoursesStr == null || minCoursesStr.isEmpty()) ? 0 : Integer.parseInt(minCoursesStr);
                    } catch (NumberFormatException nfe) {
                        minCourses = 0;
                        messages.add("Row " + row + ": invalid minCourses. Using 0.");
                    }
                    try {
                        minCredits = (minCreditsStr == null || minCreditsStr.isEmpty()) ? 0.0 : Double.parseDouble(minCreditsStr);
                    } catch (NumberFormatException nfe) {
                        minCredits = 0.0;
                        messages.add("Row " + row + ": invalid minCredits. Using 0.0.");
                    }
                    requirementRows.add(new int[]{ currentCategory.getCategoryID(), minCourses });
                    requirementCredits.add(minCredits);
                }

                // Course row when there is a currentCategory and valid code/title
                if (currentCategory != null && courseCode != null && !courseCode.isEmpty() && courseTitle != null && !courseTitle.isEmpty()) {
                    courseTitles.put(courseCode, courseTitle);
                    double credits;
                    try {
                        credits = (creditStr == null || creditStr.isEmpty()) ? fallbackCredits : Double.parseDouble(creditStr);
                    } catch (NumberFormatException nfe) {
                        credits = fallbackCredits;
                        messages.add("Row " + row + ": invalid credit value for course '" + courseCode + "'. Using default " + fallbackCredits);
                    }
                    courseCredits.put(courseCode, credits);
                    // last occurrence wins for mapping
                    courseToCategoryId.put(courseCode, currentCategory.getCategoryID());
                }
            }

            // ---------- Batch UPSERT: Courses ----------
            List<String> codes = new ArrayList<>(courseTitles.keySet());
            if (!codes.isEmpty()) {
                // Prefetch existing courses to compute created/updated counts
                List<Courses> existingCourses = coursesRepository.findByCourseCodeIn(codes);
                Set<String> existingCodes = new HashSet<>();
                for (Courses c : existingCourses) existingCodes.add(c.getCourseCode());
                createdCourses = Math.max(0, codes.size() - existingCodes.size());
                updatedCourses = existingCodes.size();

                String sqlCourses = "INSERT INTO courses (course_code, course_title, course_credits) " +
                        "VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE course_title = VALUES(course_title), course_credits = VALUES(course_credits)";
                List<Object[]> batchArgsCourses = new ArrayList<>(codes.size());
                for (String code : codes) {
                    batchArgsCourses.add(new Object[]{ code, courseTitles.get(code), courseCredits.getOrDefault(code, fallbackCredits) });
                }
                jdbcTemplate.batchUpdate(sqlCourses, batchArgsCourses);
            }

            // Refetch all courses to get IDs for mapping
            Map<String, Integer> courseIdByCode = new HashMap<>();
            if (!codes.isEmpty()) {
                for (Courses c : coursesRepository.findByCourseCodeIn(codes)) {
                    courseIdByCode.put(c.getCourseCode(), c.getCourseID());
                }
            }

            // ---------- Compute mapping counters (existing vs. new category) ----------
            Map<String, Integer> existingMapByCode = new HashMap<>();
            List<ProgramCourseCategory> existingMappingsAll = programCourseCategoryRepository.findByProgramIdWithCourseAndCategory(program.getProgramId());
            for (ProgramCourseCategory pcc : existingMappingsAll) {
                if (pcc.getCourse() != null && pcc.getCourse().getCourseCode() != null && pcc.getCategory() != null) {
                    existingMapByCode.put(pcc.getCourse().getCourseCode(), pcc.getCategory().getCategoryID());
                }
            }

            for (Map.Entry<String, Integer> e : courseToCategoryId.entrySet()) {
                String code = e.getKey();
                Integer newCatId = e.getValue();
                Integer oldCatId = existingMapByCode.get(code);
                if (oldCatId == null) createdMappings++; else if (!oldCatId.equals(newCatId)) updatedMappings++;
            }

            // ---------- Batch UPSERT: ProgramCourseCategory ----------
            if (!courseToCategoryId.isEmpty()) {
                String sqlPcc = "INSERT INTO program_course_category (program_id, course_id, category_id) " +
                        "VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE category_id = VALUES(category_id)";
                List<Object[]> batchArgsPcc = new ArrayList<>(courseToCategoryId.size());
                for (Map.Entry<String, Integer> e : courseToCategoryId.entrySet()) {
                    Integer courseId = courseIdByCode.get(e.getKey());
                    if (courseId != null) {
                        batchArgsPcc.add(new Object[]{ program.getProgramId(), courseId, e.getValue() });
                    }
                }
                if (!batchArgsPcc.isEmpty()) jdbcTemplate.batchUpdate(sqlPcc, batchArgsPcc);
            }

            // ---------- Batch UPSERT: ProgramCategoryRequirement ----------
            if (!requirementRows.isEmpty()) {
                String sqlReq = "INSERT INTO program_category_requirement (program_id, category_id, min_courses, min_credits) " +
                        "VALUES (?, ?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE min_courses = VALUES(min_courses), min_credits = VALUES(min_credits)";
                List<Object[]> batchArgsReq = new ArrayList<>(requirementRows.size());
                for (int i = 0; i < requirementRows.size(); i++) {
                    int[] ints = requirementRows.get(i);
                    Double minCred = requirementCredits.get(i);
                    batchArgsReq.add(new Object[]{ program.getProgramId(), ints[0], ints[1], minCred });
                }
                jdbcTemplate.batchUpdate(sqlReq, batchArgsReq);
            }

            messages.add("Combined CSV processed successfully.");
            messages.add("Categories - created: " + createdCategories + ", updated: " + updatedCategories);
            messages.add("Courses - created: " + createdCourses + ", updated: " + updatedCourses);
            messages.add("Course-Category mappings - created: " + createdMappings + ", updated: " + updatedMappings);
        } catch (Exception ex) {
            messages.add("Error processing CSV: " + ex.getMessage());
        }

        return messages;
    }

    private String get(String[] arr, int idx) {
        if (arr == null || idx >= arr.length) return "";
        String v = arr[idx] == null ? "" : arr[idx].trim();
        // Normalize smart quotes etc.
        return v.replace("\u201C", "\"").replace("\u201D", "\"");
    }
}
