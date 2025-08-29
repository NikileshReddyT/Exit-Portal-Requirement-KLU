package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.*;
import com.jfsd.exit_portal_backend.Repository.*;
import com.opencsv.CSVReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
    private ProgramCategoryRequirementRepository programCategoryRequirementRepository;

    public List<String> importCombinedCsv(MultipartFile file, String programCode, Double defaultCredits) {
        List<String> messages = new ArrayList<>();
        int createdCategories = 0;
        int updatedCategories = 0;
        int createdCourses = 0;
        int updatedCourses = 0;

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

                    // Create/update ProgramCategoryRequirement
                    try {
                        int minCourses = (minCoursesStr == null || minCoursesStr.isEmpty()) ? 0 : Integer.parseInt(minCoursesStr);
                        double minCredits = (minCreditsStr == null || minCreditsStr.isEmpty()) ? 0.0 : Double.parseDouble(minCreditsStr);
                        
                        Optional<ProgramCategoryRequirement> reqOpt = programCategoryRequirementRepository.findByProgramAndCategory(program, category);
                        ProgramCategoryRequirement requirement = reqOpt.orElseGet(ProgramCategoryRequirement::new);
                        requirement.setProgram(program);
                        requirement.setCategory(category);
                        requirement.setMinCourses(minCourses);
                        requirement.setMinCredits(minCredits);
                        programCategoryRequirementRepository.save(requirement);
                    } catch (NumberFormatException nfe) {
                        messages.add("Row " + row + ": invalid minCourses or minCredits. Using 0/0.0.");
                        ProgramCategoryRequirement requirement = new ProgramCategoryRequirement(program, category, 0, 0.0);
                        programCategoryRequirementRepository.save(requirement);
                    }
                }

                // Course row when there is a currentCategory and valid code/title
                if (currentCategory != null && courseCode != null && !courseCode.isEmpty() && courseTitle != null && !courseTitle.isEmpty()) {
                    Optional<Courses> courseOpt = coursesRepository.findFirstByCourseCode(courseCode);
                    Courses course = courseOpt.orElseGet(Courses::new);
                    if (courseOpt.isPresent()) {
                        updatedCourses++;
                    } else {
                        course.setCourseCode(courseCode);
                        createdCourses++;
                    }

                    course.setCourseTitle(courseTitle);
                    try {
                        double credits = (creditStr == null || creditStr.isEmpty()) ? fallbackCredits : Double.parseDouble(creditStr);
                        course.setCourseCredits(credits);
                    } catch (NumberFormatException nfe) {
                        course.setCourseCredits(fallbackCredits);
                        messages.add("Row " + row + ": invalid credit value for course '" + courseCode + "'. Using default " + fallbackCredits);
                    }

                    course = coursesRepository.save(course);

                    // Create ProgramCourseCategory mapping
                    Optional<ProgramCourseCategory> pccOpt = programCourseCategoryRepository.findByProgramAndCourse(program, course);
                    if (!pccOpt.isPresent()) {
                        ProgramCourseCategory pcc = new ProgramCourseCategory(program, course, currentCategory);
                        programCourseCategoryRepository.save(pcc);
                    }
                }
            }

            messages.add("Combined CSV processed successfully.");
            messages.add("Categories - created: " + createdCategories + ", updated: " + updatedCategories);
            messages.add("Courses - created: " + createdCourses + ", updated: " + updatedCourses);
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
