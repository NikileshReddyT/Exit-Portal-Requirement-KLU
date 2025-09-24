package com.jfsd.exit_portal_backend.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository.CategoryAggregate;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramCourseCategoryRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramCategoryRequirementRepository;
import com.jfsd.exit_portal_backend.Repository.CategoriesRepository;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
import com.jfsd.exit_portal_backend.Model.ProgramCourseCategory;
import com.jfsd.exit_portal_backend.Model.ProgramCategoryRequirement;
import com.jfsd.exit_portal_backend.Model.Categories;
import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.Cacheable;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminInsightsService {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private StudentCategoryProgressRepository progressRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private ProgramCourseCategoryRepository programCourseCategoryRepository;

    @Autowired
    private ProgramCategoryRequirementRepository programCategoryRequirementRepository;

    @Autowired
    private CategoriesRepository categoriesRepository;

    @Autowired
    private CoursesRepository coursesRepository;

    @Cacheable(cacheNames = "admin_api", key = "'buildDashboard:' + #userType + ':' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> buildDashboard(String userType, Long programId) {
        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("userType", userType);
        dashboard.put("programId", programId);

        // Resolve program context
        String programCode = null;
        if (programId != null) {
            Optional<Program> p = programRepository.findById(programId);
            if (p.isPresent()) {
                programCode = p.get().getCode();
                dashboard.put("programCode", programCode);
                dashboard.put("programName", p.get().getName());
            }
        }

        // Stats using optimized aggregates (avoid loading large progress tables)
        long completedStudents = progressRepository.countCompletedStudents(programId);

        long totalStudents;
        if ("SUPER_ADMIN".equalsIgnoreCase(userType) && programId != null) {
            // SUPER_ADMIN with specific program - count students in that program
            totalStudents = studentRepository.countByProgram_ProgramId(programId);
        } else if ("SUPER_ADMIN".equalsIgnoreCase(userType)) {
            // SUPER_ADMIN without program - count all students
            totalStudents = studentRepository.count();
        } else if (programId != null) {
            // ADMIN - count students in their assigned program
            totalStudents = studentRepository.countByProgram_ProgramId(programId);
        } else {
            totalStudents = 0;
        }

        long inProgressStudents = Math.max(0, totalStudents - completedStudents);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalStudents", totalStudents);
        stats.put("completedStudents", completedStudents);
        stats.put("inProgressStudents", inProgressStudents);
        dashboard.put("stats", stats);

        // Category summaries using aggregate query
        List<CategoryAggregate> aggs = progressRepository.aggregateByCategory(programId);
        List<Map<String, Object>> categorySummaries = aggs.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", a.getCategoryName());
            m.put("total", a.getTotal());
            m.put("met", a.getMet());
            double metRate = a.getTotal() > 0 ? ((double) a.getMet()) / ((double) a.getTotal()) : 0.0;
            double avgCredit = a.getAvgCreditCompletion();
            // round to 3 decimals to match previous behavior
            m.put("metRate", Math.round(metRate * 1000.0) / 1000.0);
            m.put("avgCreditCompletion", Math.round(avgCredit * 1000.0) / 1000.0);
            return m;
        }).sorted(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("metRate")))
          .collect(Collectors.toList());
        dashboard.put("categorySummaries", categorySummaries);

        // Bottlenecks: bottom 3 categories by metRate
        List<Map<String, Object>> bottlenecks = categorySummaries.stream()
                .sorted(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("metRate")))
                .limit(3)
                .collect(Collectors.toList());
        dashboard.put("bottlenecks", bottlenecks);

        // Risk summary & snapshots
        dashboard.put("risk", getRiskSummary(programId));

        // Course leaders/laggards by pass-rate
        Map<String, Object> lb = getCoursePassLeaderboard(programId, 5);
        dashboard.put("courseLeaderboard", lb);

        return dashboard;
    }

    // ===== Projected Category Summaries (registered treated as completed) =====
    @Cacheable(cacheNames = "admin_api", key = "'aggregateByCategoryProjected:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listCategorySummariesProjected(Long programId) {
        List<StudentCategoryProgressRepository.CategoryAggregateProjected> rows =
                progressRepository.aggregateByCategoryProjected(programId);
        return rows.stream().map(a -> {
            long total = a.getTotal();
            long metA = a.getMetActual();
            long metP = a.getMetProjected();
            double rateA = total > 0 ? ((double) metA) / ((double) total) : 0.0;
            double rateP = total > 0 ? ((double) metP) / ((double) total) : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", a.getCategoryName());
            m.put("total", total);
            m.put("metActual", metA);
            m.put("metProjected", metP);
            m.put("metRateActual", Math.round(rateA * 1000.0) / 1000.0);
            m.put("metRateProjected", Math.round(rateP * 1000.0) / 1000.0);
            return m;
        }).sorted(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("metRateProjected")))
          .collect(Collectors.toList());
    }

    // Get basic stats for dashboard
    @Cacheable(cacheNames = "admin_api", key = "'getStats:' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> getStats(Long programId) {
        Map<String, Object> stats = new LinkedHashMap<>();
        
        // Count students
        long totalStudents;
        if (programId != null) {
            totalStudents = studentRepository.countByProgram_ProgramId(programId);
        } else {
            totalStudents = studentRepository.count();
        }
        stats.put("totalStudents", totalStudents);
        
        // Count courses (simplified - just use total courses for now)
        long totalCourses = coursesRepository.count();
        stats.put("totalCourses", totalCourses);
        
        // Count grades (simplified - just use total grades for now)
        long totalGrades = studentGradeRepository.count();
        stats.put("totalGrades", totalGrades);
        
        // Count categories (simplified - just use total categories for now)
        long totalCategories = categoriesRepository.count();
        stats.put("totalCategories", totalCategories);
        
        return stats;
    }

    // Get program details by ID
    @Cacheable(cacheNames = "admin_api", key = "'getProgramById:' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> getProgramById(Long programId) {
        if (programId == null) return Collections.emptyMap();
        
        Optional<Program> programOpt = programRepository.findById(programId);
        if (programOpt.isEmpty()) return Collections.emptyMap();
        
        Program program = programOpt.get();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("programId", program.getProgramId());
        result.put("code", program.getCode());
        result.put("name", program.getName());
        
        return result;
    }

    // Build dashboard strictly for a given program (used by SUPER_ADMIN drill-down)
    @Cacheable(cacheNames = "admin_api", key = "'buildDashboardForProgram:' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> buildDashboardForProgram(Long programId) {
        System.out.println("AdminInsightsService.buildDashboardForProgram - programId: " + programId);
        if (programId == null) return Collections.emptyMap();
        Optional<Program> pOpt = programRepository.findById(programId);
        if (pOpt.isEmpty()) return Collections.emptyMap();
        Program p = pOpt.get();
        String code = p.getCode();
        System.out.println("AdminInsightsService.buildDashboardForProgram - program code: " + code);

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("userType", "SUPER_ADMIN");
        dashboard.put("programId", p.getProgramId());
        dashboard.put("programCode", code);
        dashboard.put("programName", p.getName());

        List<StudentCategoryProgress> rows = progressRepository.findByProgramCode(code);
        System.out.println("AdminInsightsService.buildDashboardForProgram - progress rows found: " + rows.size());
        Map<String, List<StudentCategoryProgress>> byStudent = rows.stream()
                .collect(Collectors.groupingBy(StudentCategoryProgress::getUniversityId));

        long completedStudents = byStudent.values().stream().filter(AdminInsightsService::isStudentComplete).count();
        long totalStudents = studentRepository.countByProgram_ProgramId(programId);
        long inProgressStudents = Math.max(0, totalStudents - completedStudents);
        System.out.println("AdminInsightsService.buildDashboardForProgram - totalStudents: " + totalStudents + ", completedStudents: " + completedStudents);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalStudents", totalStudents);
        stats.put("completedStudents", completedStudents);
        stats.put("inProgressStudents", inProgressStudents);
        dashboard.put("stats", stats);

        // Category summaries within this program
        Map<String, CategorySummary> categoryMap = new LinkedHashMap<>();
        for (StudentCategoryProgress scp : rows) {
            String cat = scp.getCategoryName();
            if (cat == null) continue;
            CategorySummary cs = categoryMap.computeIfAbsent(cat, k -> new CategorySummary());
            cs.total++;
            if (meetsRequirement(scp)) cs.met++;
            double denom = scp.getMinRequiredCredits() != null && scp.getMinRequiredCredits() > 0 ? scp.getMinRequiredCredits() : 0.0;
            double ratio = denom > 0 ? Math.min(1.0, (scp.getCompletedCredits() != null ? scp.getCompletedCredits() : 0.0) / denom) : 0.0;
            cs.creditCompletionSum += ratio;
        }
        List<Map<String, Object>> categorySummaries = categoryMap.entrySet().stream()
                .map(e -> e.getValue().toMap(e.getKey()))
                .sorted(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("metRate")))
                .collect(Collectors.toList());
        dashboard.put("categorySummaries", categorySummaries);
        List<Map<String, Object>> bottlenecks = categorySummaries.stream()
                .sorted(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("metRate")))
                .limit(3)
                .collect(Collectors.toList());
        dashboard.put("bottlenecks", bottlenecks);

        return dashboard;
    }

    // List programs: id, code, name
    @Cacheable(cacheNames = "admin_api", key = "'listPrograms'")
    public List<Map<String, Object>> listPrograms() {
        return programRepository.findAll().stream()
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", p.getProgramId());
                    m.put("code", p.getCode());
                    m.put("name", p.getName());
                    return m;
                })
                .collect(Collectors.toList());
    }

    // Rank programs by completion rate; worstFirst=true returns lowest first
    @Cacheable(cacheNames = "admin_api", key = "'rankPrograms:' + #limit + ':' + #worstFirst")
    public List<Map<String, Object>> rankPrograms(int limit, boolean worstFirst) {
        List<Program> programs = programRepository.findAll();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Program p : programs) {
            List<StudentCategoryProgress> scps = progressRepository.findByProgramCode(p.getCode());
            Map<String, List<StudentCategoryProgress>> byStudent = scps.stream()
                    .collect(Collectors.groupingBy(StudentCategoryProgress::getUniversityId));
            long completed = byStudent.values().stream().filter(AdminInsightsService::isStudentComplete).count();
            long total = studentRepository.countByProgram_ProgramId(p.getProgramId());
            double rate = total > 0 ? (double) completed / (double) total : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("programId", p.getProgramId());
            m.put("programCode", p.getCode());
            m.put("programName", p.getName());
            m.put("totalStudents", total);
            m.put("completedStudents", completed);
            m.put("completionRate", Math.round(rate * 1000.0) / 1000.0);
            rows.add(m);
        }
        Comparator<Map<String, Object>> cmp = Comparator.comparingDouble(m -> (Double) m.get("completionRate"));
        rows.sort(worstFirst ? cmp : cmp.reversed());
        if (limit > 0 && rows.size() > limit) {
            return rows.subList(0, limit);
        }
        return rows;
    }

    // ===== Data Explorer Listings =====
    @Cacheable(cacheNames = "admin_api", key = "'listStudents:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listStudents(Long programId) {
        List<Student> students;
        if (programId != null) {
            // Use derived query to avoid loading all students when program is scoped
            students = studentRepository.findByProgram_ProgramId(programId);
        } else {
            students = studentRepository.findAll();
        }
        return students.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", s.getStudentId());
            m.put("studentName", s.getStudentName());
            if (s.getProgram() != null) {
                m.put("programId", s.getProgram().getProgramId());
                m.put("programCode", s.getProgram().getCode());
                m.put("programName", s.getProgram().getName());
            }
            return m;
        }).collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listCategories:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listCategories(Long programId) {
        List<Categories> cats;
        if (programId != null) {
            Optional<Program> p = programRepository.findById(programId);
            cats = p.map(categoriesRepository::findByProgram).orElse(Collections.emptyList());
        } else {
            cats = categoriesRepository.findAll();
        }
        return cats.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("categoryId", c.getCategoryID());
            m.put("categoryName", c.getCategoryName());
            if (c.getProgram() != null) {
                m.put("programId", c.getProgram().getProgramId());
                m.put("programCode", c.getProgram().getCode());
                m.put("programName", c.getProgram().getName());
            }
            return m;
        }).collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listCourses:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listCourses(Long programId) {
        if (programId == null) {
            // All courses without program scoping
            return coursesRepository.findAll().stream().map(this::toCourseMap).collect(Collectors.toList());
        }
        // Use mapping table to derive program-specific courses
        List<ProgramCourseCategory> mappings = programCourseCategoryRepository.findByProgramIdWithCourseAndCategory(programId);
        return mappings.stream()
                .map(ProgramCourseCategory::getCourse)
                .filter(Objects::nonNull)
                .distinct()
                .map(this::toCourseMap)
                .collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listMappings:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listMappings(Long programId) {
        List<ProgramCourseCategory> mappings;
        if (programId != null) {
            mappings = programCourseCategoryRepository.findByProgramIdWithCourseAndCategory(programId);
        } else {
            mappings = programCourseCategoryRepository.findAll();
        }
        return mappings.stream().map(pcc -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", pcc.getId());
            if (pcc.getProgram() != null) {
                m.put("programId", pcc.getProgram().getProgramId());
                m.put("programCode", pcc.getProgram().getCode());
                m.put("programName", pcc.getProgram().getName());
            }
            if (pcc.getCourse() != null) {
                m.put("courseId", pcc.getCourse().getCourseID());
                m.put("courseCode", pcc.getCourse().getCourseCode());
                m.put("courseTitle", pcc.getCourse().getCourseTitle());
                m.put("courseCredits", pcc.getCourse().getCourseCredits());
            }
            if (pcc.getCategory() != null) {
                m.put("categoryId", pcc.getCategory().getCategoryID());
                m.put("categoryName", pcc.getCategory().getCategoryName());
            }
            return m;
        }).collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listRequirements:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> listRequirements(Long programId) {
        List<ProgramCategoryRequirement> reqs;
        if (programId != null) {
            Optional<Program> p = programRepository.findById(programId);
            reqs = p.map(programCategoryRequirementRepository::findByProgram).orElse(Collections.emptyList());
        } else {
            reqs = programCategoryRequirementRepository.findAll();
        }
        return reqs.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            if (r.getProgram() != null) {
                m.put("programId", r.getProgram().getProgramId());
                m.put("programCode", r.getProgram().getCode());
                m.put("programName", r.getProgram().getName());
            }
            if (r.getCategory() != null) {
                m.put("categoryId", r.getCategory().getCategoryID());
                m.put("categoryName", r.getCategory().getCategoryName());
            }
            m.put("minCourses", r.getMinCourses());
            m.put("minCredits", r.getMinCredits());
            return m;
        }).collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listGrades:' + T(java.util.Objects).toString(#programId) + ':' + T(java.util.Objects).toString(#studentId)")
    public List<Map<String, Object>> listGrades(Long programId, String studentId) {
        List<StudentGrade> grades;
        if (studentId != null && !studentId.isBlank()) {
            grades = studentGradeRepository.findWithCourseByStudentId(studentId);
        } else if (programId != null) {
            Optional<Program> pOpt = programRepository.findById(programId);
            if (pOpt.isEmpty()) return Collections.emptyList();
            String code = pOpt.get().getCode();
            List<String> ids = studentGradeRepository.findStudentIdsByProgramCode(code);
            grades = ids.isEmpty() ? Collections.emptyList() : studentGradeRepository.findByStudent_StudentIdIn(new HashSet<>(ids));
        } else {
            grades = studentGradeRepository.findAll();
        }
        return grades.stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sno", g.getSno());
            if (g.getStudent() != null) {
                m.put("studentId", g.getStudent().getStudentId());
            }
            m.put("courseCode", g.getCourseCode());
            m.put("courseName", g.getCourseName());
            m.put("credits", g.getCredits());
            m.put("grade", g.getGrade());
            m.put("gradePoint", g.getGradePoint());
            m.put("category", g.getCategory());
            m.put("year", g.getYear());
            m.put("semester", g.getSemester());
            m.put("promotion", g.getPromotion());
            return m;
        }).collect(Collectors.toList());
    }

    // Paginated grades listing for performance
    @Cacheable(cacheNames = "admin_api", key = "'listGradesPaged:' + T(java.util.Objects).toString(#programId) + ':' + T(java.util.Objects).toString(#studentId) + ':' + T(java.util.Objects).toString(#category) + ':' + #page + ':' + #size")
    public Map<String, Object> listGradesPaged(Long programId, String studentId, String category, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<StudentGrade> pg;
        boolean hasStudent = studentId != null && !studentId.isBlank();
        boolean hasCategory = category != null && !category.isBlank();

        if (hasStudent && hasCategory) {
            // Student+Category filter (student is unique enough; program scoping not required)
            pg = studentGradeRepository.findByStudent_StudentIdAndCategory(studentId.trim(), category.trim(), pageable);
        } else if (hasStudent && programId != null) {
            pg = studentGradeRepository.findByStudent_Program_ProgramIdAndStudent_StudentId(programId, studentId.trim(), pageable);
        } else if (hasStudent) {
            pg = studentGradeRepository.findByStudent_StudentId(studentId.trim(), pageable);
        } else if (programId != null) {
            pg = studentGradeRepository.findByStudent_Program_ProgramId(programId, pageable);
        } else {
            pg = studentGradeRepository.findAll(pageable);
        }

        List<Map<String, Object>> content = pg.getContent().stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sno", g.getSno());
            if (g.getStudent() != null) {
                m.put("studentId", g.getStudent().getStudentId());
            }
            m.put("courseCode", g.getCourseCode());
            m.put("courseName", g.getCourseName());
            m.put("credits", g.getCredits());
            m.put("grade", g.getGrade());
            m.put("gradePoint", g.getGradePoint());
            m.put("category", g.getCategory());
            m.put("year", g.getYear());
            m.put("semester", g.getSemester());
            m.put("promotion", g.getPromotion());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", content);
        out.put("page", pg.getNumber());
        out.put("size", pg.getSize());
        out.put("totalElements", pg.getTotalElements());
        out.put("totalPages", pg.getTotalPages());
        out.put("hasNext", pg.hasNext());
        out.put("hasPrevious", pg.hasPrevious());
        return out;
    }

    // List only courses that belong to a specific category (optionally scoped by program)
    @Cacheable(cacheNames = "admin_api", key = "'listCoursesByCategory:' + T(java.util.Objects).toString(#programId) + ':' + T(java.util.Objects).toString(#categoryName)")
    public List<Map<String, Object>> listCoursesByCategory(Long programId, String categoryName) {
        if (categoryName == null || categoryName.isBlank()) return Collections.emptyList();
        List<ProgramCourseCategory> mappings;
        if (programId != null) {
            mappings = programCourseCategoryRepository.findByProgramIdAndCategoryName(programId, categoryName);
        } else {
            mappings = programCourseCategoryRepository.findByCategoryName(categoryName);
        }
        return mappings.stream()
                .map(ProgramCourseCategory::getCourse)
                .filter(Objects::nonNull)
                .distinct()
                .map(this::toCourseMap)
                .collect(Collectors.toList());
    }

    // List students who completed a given course (promotion == 'P'), optionally scoped by program
    @Cacheable(cacheNames = "admin_api", key = "'listCourseCompleters:' + T(java.util.Objects).toString(#programId) + ':' + T(java.util.Objects).toString(#courseCode)")
    public List<Map<String, Object>> listCourseCompleters(Long programId, String courseCode) {
        if (courseCode == null || courseCode.isBlank()) return Collections.emptyList();
        List<StudentGrade> rows;
        if (programId != null) {
            rows = studentGradeRepository.findByCourse_CourseCodeAndPromotionIgnoreCaseAndStudent_Program_ProgramId(courseCode, "P", programId);
        } else {
            rows = studentGradeRepository.findByCourse_CourseCodeAndPromotionIgnoreCase(courseCode, "P");
        }
        return rows.stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            if (g.getStudent() != null) {
                m.put("studentId", g.getStudent().getStudentId());
                m.put("studentName", g.getStudent().getStudentName());
                if (g.getStudent().getProgram() != null) {
                    m.put("programId", g.getStudent().getProgram().getProgramId());
                    m.put("programCode", g.getStudent().getProgram().getCode());
                    m.put("programName", g.getStudent().getProgram().getName());
                }
            }
            m.put("courseCode", courseCode);
            m.put("grade", g.getGrade());
            m.put("gradePoint", g.getGradePoint());
            m.put("year", g.getYear());
            m.put("semester", g.getSemester());
            m.put("category", g.getCategory());
            return m;
        }).collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'listProgress:' + T(java.util.Objects).toString(#programId) + ':' + T(java.util.Objects).toString(#studentId)")
    public List<Map<String, Object>> listProgress(Long programId, String studentId) {
        List<StudentCategoryProgress> rows;
        if (studentId != null && !studentId.isBlank() && programId != null) {
            Optional<Program> pOpt = programRepository.findById(programId);
            if (pOpt.isEmpty()) return Collections.emptyList();
            rows = progressRepository.findByUniversityIdAndProgramCode(studentId, pOpt.get().getCode());
        } else if (studentId != null && !studentId.isBlank()) {
            rows = progressRepository.findByUniversityId(studentId);
        } else if (programId != null) {
            Optional<Program> pOpt = programRepository.findById(programId);
            if (pOpt.isEmpty()) return Collections.emptyList();
            rows = progressRepository.findByProgramCode(pOpt.get().getCode());
        } else {
            rows = progressRepository.findAll();
        }
        return rows.stream().map(scp -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", scp.getId());
            m.put("universityId", scp.getUniversityId());
            m.put("studentName", scp.getStudentName());
            m.put("categoryName", scp.getCategoryName());
            m.put("minRequiredCourses", scp.getMinRequiredCourses());
            m.put("minRequiredCredits", scp.getMinRequiredCredits());
            m.put("completedCourses", scp.getCompletedCourses());
            m.put("completedCredits", scp.getCompletedCredits());
            if (scp.getProgram() != null) {
                m.put("programId", scp.getProgram().getProgramId());
                m.put("programCode", scp.getProgram().getCode());
                m.put("programName", scp.getProgram().getName());
            }
            return m;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> toCourseMap(Courses c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("courseId", c.getCourseID());
        m.put("courseCode", c.getCourseCode());
        m.put("courseTitle", c.getCourseTitle());
        m.put("courseCredits", c.getCourseCredits());
        return m;
    }

    private static boolean isStudentComplete(List<StudentCategoryProgress> rows) {
        if (rows == null || rows.isEmpty()) return false;
        for (StudentCategoryProgress scp : rows) {
            if (!meetsRequirement(scp)) return false;
        }
        return true;
    }

    private static boolean meetsRequirement(StudentCategoryProgress scp) {
        Integer minCourses = scp.getMinRequiredCourses();
        Double minCredits = scp.getMinRequiredCredits();
        Integer doneCourses = scp.getCompletedCourses();
        Double doneCredits = scp.getCompletedCredits();
        boolean coursesOk = (minCourses == null || minCourses <= 0) || (doneCourses != null && doneCourses >= minCourses);
        boolean creditsOk = (minCredits == null || minCredits <= 0) || (doneCredits != null && doneCredits >= minCredits);
        return coursesOk && creditsOk;
    }

    private static class CategorySummary {
        long total = 0;
        long met = 0;
        double creditCompletionSum = 0.0; // aggregated ratio in [0,1]

        Map<String, Object> toMap(String name) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", name);
            m.put("total", total);
            m.put("met", met);
            double metRate = total > 0 ? (double) met / (double) total : 0.0;
            double avgCreditCompletion = total > 0 ? creditCompletionSum / (double) total : 0.0;
            m.put("metRate", round(metRate));
            m.put("avgCreditCompletion", round(avgCreditCompletion));
            return m;
        }

        private double round(double v) {
            return Math.round(v * 1000.0) / 1000.0; // 3 decimals
        }
    }

    // ===== Overview insights helpers =====
    @Cacheable(cacheNames = "admin_api", key = "'getRiskSummary:' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> getRiskSummary(Long programId) {
        Map<String, Object> m = new LinkedHashMap<>();
        long exact0 = progressRepository.countCompletedStudents(programId);
        long leq5 = progressRepository.countStudentsWithNotMetCategoriesAtMost(programId, 5);
        long closeLeq5 = Math.max(0, leq5 - exact0); // students with 1..5 unmet categories
        long nonPass = (programId != null)
                ? studentGradeRepository.countDistinctStudentsWithAnyNonPassByProgram(programId)
                : studentGradeRepository.countDistinctStudentsWithAnyNonPass();
        m.put("exact0", exact0);
        m.put("closeLeq5", closeLeq5);
        m.put("nonPassAny", nonPass);
        return m;
    }

    @Cacheable(cacheNames = "admin_api", key = "'getCompletionTrend:' + T(java.util.Objects).toString(#programId)")
    public List<Map<String, Object>> getCompletionTrend(Long programId) {
        List<Object[]> rows = (programId != null)
                ? studentGradeRepository.countPromotionsByTermAndProgram(programId)
                : studentGradeRepository.countPromotionsByTerm();
        return rows.stream().map(r -> {
            String yr = String.valueOf(r[0]);
            String sem = String.valueOf(r[1]);
            long passCnt = ((Number) r[2]).longValue();
            long totalCnt = ((Number) r[3]).longValue();
            double passRate = totalCnt > 0 ? (double) passCnt / (double) totalCnt : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("year", yr);
            m.put("semester", sem);
            m.put("passCnt", passCnt);
            m.put("totalCnt", totalCnt);
            m.put("passRate", Math.round(passRate * 1000.0) / 1000.0);
            m.put("label", (yr != null ? yr : "NA") + "-" + (sem != null ? sem : "NA"));
            return m;
        }).sorted(Comparator
                .comparing((Map<String, Object> e) -> String.valueOf(e.get("year")))
                .thenComparing(e -> String.valueOf(e.get("semester"))))
          .collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "admin_api", key = "'getCoursePassLeaderboard:' + T(java.util.Objects).toString(#programId) + ':' + #limit")
    public Map<String, Object> getCoursePassLeaderboard(Long programId, int limit) {
        List<Object[]> rows = (programId != null)
                ? studentGradeRepository.aggregateCoursePassRatesByProgram(programId)
                : studentGradeRepository.aggregateCoursePassRates();
        List<Map<String, Object>> items = rows.stream().map(r -> {
            String code = String.valueOf(r[0]);
            String title = r.length > 1 && r[1] != null ? String.valueOf(r[1]) : null;
            // shift indices because title is now at index 1
            long pass = ((Number) r[2]).longValue();
            long total = ((Number) r[3]).longValue();
            double rate = total > 0 ? (double) pass / (double) total : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("courseCode", code);
            if (title != null && !title.isBlank()) {
                m.put("courseTitle", title);
            }
            m.put("passCnt", pass);
            m.put("totalCnt", total);
            m.put("passRate", Math.round(rate * 1000.0) / 1000.0);
            return m;
        }).sorted(Comparator.comparing((Map<String, Object> e) -> (Double) e.get("passRate"))).collect(Collectors.toList());

        List<Map<String, Object>> laggards = items.stream().limit(Math.max(1, limit)).collect(Collectors.toList());
        List<Map<String, Object>> leaders = items.stream().sorted(Comparator.comparing((Map<String, Object> e) -> (Double) e.get("passRate")).reversed())
                .limit(Math.max(1, limit)).collect(Collectors.toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("leaders", leaders);
        out.put("laggards", laggards);
        return out;
    }

    @Cacheable(cacheNames = "admin_api", key = "'getDataFreshness:' + T(java.util.Objects).toString(#programId)")
    public Map<String, Object> getDataFreshness(Long programId) {
        Object[] r = (programId != null)
                ? studentGradeRepository.findMaxYearAndSemesterByProgram(programId)
                : studentGradeRepository.findMaxYearAndSemester();
        Map<String, Object> m = new LinkedHashMap<>();
        if (r != null && r.length >= 2) {
            m.put("latestYear", r[0]);
            m.put("latestSemester", r[1]);
        } else {
            m.put("latestYear", null);
            m.put("latestSemester", null);
        }
        return m;
    }

    // Students who met a given category (optionally scoped by program)
    public List<Map<String, Object>> listStudentsWhoMetCategory(Long programId, String categoryName) {
        if (categoryName == null || categoryName.isBlank()) return Collections.emptyList();
        List<StudentCategoryProgressRepository.MetProjection> rows =
                progressRepository.findStudentsWhoMetCategory(programId, categoryName);
        return rows.stream().map(mp -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", mp.getUniversityId());
            m.put("studentName", mp.getStudentName());
            return m;
        }).collect(Collectors.toList());
    }

    // ===== Search helpers for autocomplete and details =====
    public List<Map<String, Object>> searchStudents(Long programId, String q, int limit) {
        if (q == null || q.isBlank()) return Collections.emptyList();
        String query = q.trim();
        List<Student> byId;
        List<Student> byName;
        if (programId != null) {
            byId = studentRepository.findByProgram_ProgramIdAndStudentIdContainingIgnoreCase(programId, query);
            byName = studentRepository.findByProgram_ProgramIdAndStudentNameContainingIgnoreCase(programId, query);
        } else {
            byId = studentRepository.findByStudentIdContainingIgnoreCase(query);
            byName = studentRepository.findByStudentNameContainingIgnoreCase(query);
        }
        // Merge and distinct by studentId
        Map<String, Student> merged = new LinkedHashMap<>();
        for (Student s : byId) merged.putIfAbsent(s.getStudentId(), s);
        for (Student s : byName) merged.putIfAbsent(s.getStudentId(), s);
        return merged.values().stream()
                .limit(Math.max(1, limit))
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("studentId", s.getStudentId());
                    m.put("studentName", s.getStudentName());
                    if (s.getProgram() != null) {
                        m.put("programId", s.getProgram().getProgramId());
                        m.put("programCode", s.getProgram().getCode());
                        m.put("programName", s.getProgram().getName());
                    }
                    return m;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> getStudentBasic(String studentId) {
        if (studentId == null || studentId.isBlank()) return Collections.emptyMap();
        Optional<Student> sOpt = studentRepository.findByStudentId(studentId.trim());
        if (sOpt.isEmpty()) return Collections.emptyMap();
        Student s = sOpt.get();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("studentId", s.getStudentId());
        m.put("studentName", s.getStudentName());
        if (s.getProgram() != null) {
            m.put("programId", s.getProgram().getProgramId());
            m.put("programCode", s.getProgram().getCode());
            m.put("programName", s.getProgram().getName());
        }
        return m;
    }

    public List<Map<String, Object>> searchCategories(Long programId, String q, int limit) {
        if (q == null || q.isBlank()) return Collections.emptyList();
        String query = q.trim();
        List<Categories> cats;
        if (programId != null) {
            Optional<Program> p = programRepository.findById(programId);
            cats = p.map(pr -> categoriesRepository.findByProgramAndCategoryNameContainingIgnoreCase(pr, query))
                    .orElse(Collections.emptyList());
        } else {
            cats = categoriesRepository.findByCategoryNameContainingIgnoreCase(query);
        }
        return cats.stream()
                .limit(Math.max(1, limit))
                .map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("categoryId", c.getCategoryID());
                    m.put("categoryName", c.getCategoryName());
                    if (c.getProgram() != null) {
                        m.put("programId", c.getProgram().getProgramId());
                        m.put("programCode", c.getProgram().getCode());
                        m.put("programName", c.getProgram().getName());
                    }
                    return m;
                })
                .collect(Collectors.toList());
    }

    // ===== Course stats: grade and promotion distributions, registered count =====
    public Map<String, Object> getCourseStats(Long programId, String courseCode) {
        if (courseCode == null || courseCode.isBlank()) return Collections.emptyMap();
        String code = courseCode.trim();

        List<Object[]> gradeRows = (programId != null)
                ? studentGradeRepository.countGradesByCourseAndProgram(code, programId)
                : studentGradeRepository.countGradesByCourse(code);

        List<Object[]> promotionRows = (programId != null)
                ? studentGradeRepository.countPromotionsByCourseAndProgram(code, programId)
                : studentGradeRepository.countPromotionsByCourse(code);

        long registered = (programId != null)
                ? studentGradeRepository.countDistinctStudentsByCourseAndProgram(code, programId)
                : studentGradeRepository.countDistinctStudentsByCourse(code);

        List<Map<String, Object>> gradeCounts = gradeRows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("grade", String.valueOf(r[0]));
            m.put("count", ((Number) r[1]).longValue());
            return m;
        }).collect(Collectors.toList());

        List<Map<String, Object>> promotionCounts = promotionRows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("promotion", String.valueOf(r[0]));
            m.put("count", ((Number) r[1]).longValue());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("courseCode", code);
        out.put("registeredCount", registered);
        out.put("gradeCounts", gradeCounts);
        out.put("promotionCounts", promotionCounts);
        return out;
    }
}
