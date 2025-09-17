package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramCourseCategoryRepository;
import com.jfsd.exit_portal_backend.Model.ProgramCourseCategory;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import com.jfsd.exit_portal_backend.Model.Program;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class StudentGradeBatchImportService {

    private static final Logger log = LoggerFactory.getLogger(StudentGradeBatchImportService.class);

    private static class ParsedUpdate {
        final String universityId;
        final String courseCode;
        final String gradeToken;
        ParsedUpdate(String universityId, String courseCode, String gradeToken) {
            this.universityId = universityId;
            this.courseCode = courseCode;
            this.gradeToken = gradeToken;
        }
    }

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private CoursesRepository coursesRepository;

    @Autowired
    private StudentCategoryProgressService studentCategoryProgressService;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProgramCourseCategoryRepository programCourseCategoryRepository;

    @Autowired
    private ProgramRepository programRepository;

    private static final int BATCH_SIZE = 3000; // larger batches for fewer DB round-trips

    public List<String> importResultsCsv(MultipartFile file, String programCode, Double defaultCredits) {
        List<String> messages = new ArrayList<>();
        if (file == null || file.isEmpty()) {
            messages.add("No file uploaded.");
            return messages;
        }

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> lines = br.lines().collect(Collectors.toList());
            if (lines.size() <= 1) {
                messages.add("CSV is empty or header-only.");
                return messages;
            }

            // Detect duplicate student IDs (first column) in the CSV
            Map<String, Integer> idFreq = new HashMap<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] row = parseCsvLine(lines.get(i));
                if (row.length > 0 && row[0] != null) {
                    String id = row[0].trim();
                    if (!id.isEmpty()) idFreq.merge(id, 1, Integer::sum);
                }
            }
            List<String> duplicateIds = idFreq.entrySet().stream()
                    .filter(e -> e.getValue() > 1)
                    .map(e -> e.getKey() + " (" + e.getValue() + " times)")
                    .collect(Collectors.toList());
            if (!duplicateIds.isEmpty()) {
                messages.add("Duplicate student IDs in Results CSV" + (programCode != null && !programCode.trim().isEmpty() ? " for program " + programCode.trim() : "") + ": " + String.join(", ", duplicateIds));
            }

            String headerLine = lines.get(0);
            String[] header = parseCsvLine(headerLine);
            int obtainedIdx = indexOfHeader(header, "OBTAINED CREDITS");
            if (obtainedIdx < 0) {
                messages.add("OBTAINED CREDITS column not found in header.");
                return messages;
            }
            int firstCourseCol = obtainedIdx + 1;
            if (firstCourseCol >= header.length) {
                messages.add("No course columns found after OBTAINED CREDITS.");
                return messages;
            }

            // Extract course codes from header
            List<String> courseCodes = new ArrayList<>();
            String[] headerCourseCodes = new String[header.length];
            for (int j = firstCourseCol; j < header.length; j++) {
                String code = norm(header[j]);
                headerCourseCodes[j] = code;
                if (!code.isEmpty()) courseCodes.add(code);
            }
            long tCourseFetchStart = System.nanoTime();
            Map<String, Courses> courseByCode = coursesRepository.findByCourseCodeIn(courseCodes)
                    .stream()
                    .filter(c -> c.getCourseCode() != null)
                    .collect(Collectors.toMap(c -> norm(c.getCourseCode()), c -> c, (a, b) -> a));
            long tCourseFetchMs = (System.nanoTime() - tCourseFetchStart) / 1_000_000;
            log.info("Header course codes: {}. Matched in DB: {}. Course preload took {} ms.", courseCodes.size(), courseByCode.size(), tCourseFetchMs);

            // Preload course -> category mapping for the selected program (if provided)
            Map<String, String> categoryByCourse = new HashMap<>();
            if (programCode != null && !programCode.trim().isEmpty()) {
                try {
                    List<ProgramCourseCategory> mappings = programCourseCategoryRepository.findByProgramCode(programCode.trim());
                    for (ProgramCourseCategory pcc : mappings) {
                        if (pcc.getCourse() != null && pcc.getCourse().getCourseCode() != null &&
                                pcc.getCategory() != null && pcc.getCategory().getCategoryName() != null) {
                            categoryByCourse.put(norm(pcc.getCourse().getCourseCode()), pcc.getCategory().getCategoryName());
                        }
                    }
                    log.info("Preloaded {} course->category mappings for program {}", categoryByCourse.size(), programCode);
                } catch (Exception ex) {
                    log.warn("Failed to preload ProgramCourseCategory for program {}: {}", programCode, ex.getMessage());
                }
            } else {
                log.warn("No programCode provided; categories will remain empty.");
            }

            // Track unmapped course codes encountered in CSV (to be skipped)
            Set<String> skippedCourseCodes = new HashSet<>();

            // Resolve Program entity once (if provided)
            Program programEntity = null;
            if (programCode != null && !programCode.trim().isEmpty()) {
                programEntity = programRepository.findByCode(programCode.trim()).orElse(null);
            }

            // Preload existing grades for all students in the CSV for faster upsert
            Set<String> studentIds = lines.stream().skip(1)
                    .parallel()
                    .map(this::parseCsvLine)
                    .filter(arr -> arr.length > 0 && arr[0] != null && !arr[0].trim().isEmpty())
                    .map(arr -> arr[0].trim())
                    .collect(Collectors.toSet());
            log.info("Unique students in Results CSV: {}", studentIds.size());

            // Upsert Students: preload existing and create missing with BCrypt(studentId)
            Map<String, Student> existingStudents = studentRepository.findAllByStudentIdIn(studentIds)
                    .stream().collect(Collectors.toMap(Student::getStudentId, s -> s));
            // build name map from CSV second column if present
            Map<String, String> nameById = new HashMap<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] row = parseCsvLine(lines.get(i));
                if (row.length > 1) {
                    String id = row[0] == null ? "" : row[0].trim();
                    String name = row[1] == null ? "" : row[1].trim();
                    if (!id.isEmpty() && !name.isEmpty()) nameById.put(id, name);
                }
            }
            List<Student> toCreate = new ArrayList<>();
            for (String id : studentIds) {
                if (!existingStudents.containsKey(id)) {
                    String name = nameById.getOrDefault(id, "");
                    Student s = new Student(id, name, passwordEncoder.encode(id));
                    if (programEntity != null) {
                        s.setProgram(programEntity);
                    }
                    toCreate.add(s);
                    existingStudents.put(id, s);
                }
            }
            if (!toCreate.isEmpty()) {
                studentRepository.saveAll(toCreate);
            }
            // Program-aware handling for existing students
            Set<String> skipStudentIds = new HashSet<>();
            List<Student> toUpdateProgram = new ArrayList<>();
            if (programEntity != null) {
                for (String id : studentIds) {
                    Student s = existingStudents.get(id);
                    if (s == null) continue;
                    Program sp = s.getProgram();
                    if (sp == null) {
                        // bind student to selected program if currently unassigned
                        s.setProgram(programEntity);
                        toUpdateProgram.add(s);
                    } else if (!Objects.equals(sp.getProgramId(), programEntity.getProgramId())) {
                        // program mismatch: skip this student's updates for this import
                        skipStudentIds.add(id);
                    }
                }
                if (!toUpdateProgram.isEmpty()) {
                    studentRepository.saveAll(toUpdateProgram);
                }
                if (!skipStudentIds.isEmpty()) {
                    messages.add("Skipped students due to program mismatch with " + programCode.trim() + ": " + String.join(", ", skipStudentIds));
                }
            }
            long tExistingFetchStart = System.nanoTime();
            List<StudentGrade> existingGrades = studentGradeRepository.findByStudent_StudentIdIn(studentIds);
            long tExistingFetchMs = (System.nanoTime() - tExistingFetchStart) / 1_000_000;
            log.info("Preloaded existing grade rows: {} in {} ms", existingGrades.size(), tExistingFetchMs);
            Map<String, StudentGrade> existingByKey = existingGrades.stream()
                    .filter(g -> g.getCourse() != null && g.getCourse().getCourseCode() != null && g.getStudent() != null)
                    .collect(Collectors.toMap(g -> g.getStudent().getStudentId() + "-" + norm(g.getCourse().getCourseCode()), g -> g, (a, b) -> a));
            // Parse rows in parallel to build updates, logging every 10 rows
            AtomicInteger parsedRowCounter = new AtomicInteger(0);
            long tUpdatesStart = System.nanoTime();
            List<ParsedUpdate> updates = lines.subList(1, lines.size()).parallelStream()
                    .map(this::parseCsvLine)
                    .filter(row -> row.length > firstCourseCol && row[0] != null && !row[0].trim().isEmpty())
                    .flatMap(row -> {
                        int rowNum = parsedRowCounter.incrementAndGet();
                        if (rowNum % 10 == 0) {
                            log.info("Parsed {} rows from Results CSV...", rowNum);
                        }
                        String universityId = row[0].trim();
                        // Skip updates for students whose existing program differs from selected program
                        if (programCode != null && !programCode.trim().isEmpty() && skipStudentIds.contains(universityId)) {
                            return java.util.stream.Stream.<ParsedUpdate>empty();
                        }
                        // studentName is captured earlier into nameById map; no need to carry in ParsedUpdate
                        List<ParsedUpdate> rowUpdates = new ArrayList<>();
                        int rowLen = row.length;
                        for (int j = firstCourseCol; j < header.length && j < rowLen; j++) {
                            String courseCode = headerCourseCodes[j];
                            if (courseCode == null || courseCode.isEmpty()) continue;
                            // If programCode is provided, only allow courses mapped to that program; skip others
                            if (programCode != null && !programCode.trim().isEmpty()) {
                                if (!categoryByCourse.containsKey(courseCode)) {
                                    skippedCourseCodes.add(courseCode);
                                    continue;
                                }
                            }
                            String cell = row[j] == null ? "" : row[j].trim();
                            if (cell.isEmpty()) continue;
                            String gradeToken = extractGradeToken(cell);
                            if (gradeToken.isEmpty()) continue;
                            rowUpdates.add(new ParsedUpdate(universityId, courseCode, gradeToken));
                        }
                        return rowUpdates.stream();
                    })
                    .collect(Collectors.toList());
            long tUpdatesMs = (System.nanoTime() - tUpdatesStart) / 1_000_000;
            log.info("Generated {} course-grade updates from CSV in {} ms", updates.size(), tUpdatesMs);

            if (programCode != null && !programCode.trim().isEmpty() && !skippedCourseCodes.isEmpty()) {
                messages.add("Skipped unmapped course codes for program " + programCode.trim() + ": " + String.join(", ", skippedCourseCodes));
            }

            // Deduplicate by key, assemble entities and count created/updated
            Map<String, StudentGrade> upsertsByKey = new LinkedHashMap<>();
            Set<String> createdKeys = new HashSet<>();
            Set<String> updatedKeys = new HashSet<>();

            long tAssembleStart = System.nanoTime();
            int assembled = 0;
            Set<String> affectedStudentIds = new HashSet<>();
            for (ParsedUpdate u : updates) {
                Courses course = courseByCode.get(u.courseCode);
                if (course == null) {
                    messages.add("Course not found for code " + u.courseCode + ", skipping.");
                    continue;
                }
                String key = u.universityId + "-" + u.courseCode;
                StudentGrade grade = upsertsByKey.get(key);
                if (grade == null) {
                    grade = existingByKey.get(key);
                    if (grade == null) {
                        grade = new StudentGrade();
                        Student s = existingStudents.get(u.universityId);
                        if (s == null) {
                            s = new Student(u.universityId, nameById.getOrDefault(u.universityId, ""), passwordEncoder.encode(u.universityId));
                            if (programEntity != null) {
                                s.setProgram(programEntity);
                            }
                            s = studentRepository.save(s);
                            existingStudents.put(u.universityId, s);
                        }
                        grade.setStudent(s);
                        createdKeys.add(key);
                    } else {
                        updatedKeys.add(key);
                    }
                }
                grade.setCourse(course);

                // apply grade and promotion logic
                String promotion;
                Double gradePoint;
                if (isFailLike(u.gradeToken)) {
                    promotion = u.gradeToken; // DT, NA, F, BLNA
                    gradePoint = 0.0;
                } else {
                    promotion = "P";
                    gradePoint = mapGradePoint(u.gradeToken);
                }

                grade.setGrade(u.gradeToken);
                grade.setPromotion(promotion);
                grade.setGradePoint(gradePoint);
                // Note: Category is now stored directly in StudentGrade
                // Course-to-category mapping is handled by ProgramCourseCategory
                // Apply mapped category if available for this course within the selected program
                String mappedCategory = categoryByCourse.get(u.courseCode);
                if (programCode != null && !programCode.trim().isEmpty() && (mappedCategory == null || mappedCategory.isEmpty())) {
                    // Shouldn't occur due to earlier filter, but guard anyway: skip if not mapped to program
                    continue;
                }
                grade.setCategory(mappedCategory != null ? mappedCategory : "");

                upsertsByKey.put(key, grade);
                affectedStudentIds.add(u.universityId);
                assembled++;
                if (assembled % 10000 == 0) {
                    log.info("Assembled {} updates into entities...", assembled);
                }
            }
            long tAssembleMs = (System.nanoTime() - tAssembleStart) / 1_000_000;
            log.info("Assembly complete: entities to save: {} (created: {}, updated: {}). Took {} ms.", upsertsByKey.size(), createdKeys.size(), updatedKeys.size(), tAssembleMs);

            List<StudentGrade> toSave = new ArrayList<>(upsertsByKey.values());
            // Step 3: Native bulk upsert path using MySQL INSERT ... ON DUPLICATE KEY UPDATE
            // Ensure unique index exists so upsert updates instead of duplicating
            ensureUniqueIndexForUpsert();

            int totalBatches = (toSave.size() + BATCH_SIZE - 1) / BATCH_SIZE;
            log.info("Starting native bulk upsert for {} rows in {} batches (batchSize={})", toSave.size(), totalBatches, BATCH_SIZE);
            int batchIndex = 0;
            int totalAffected = 0;
            for (int start = 0; start < toSave.size(); start += BATCH_SIZE) {
                int end = Math.min(start + BATCH_SIZE, toSave.size());
                List<StudentGrade> batch = toSave.subList(start, end);
                int currentBatch = batchIndex + 1;
                long tBatchStart = System.nanoTime();
                int[][] counts = bulkUpsertStudentGrades(batch);
                long batchMs = (System.nanoTime() - tBatchStart) / 1_000_000;
                int affected = 0;
                for (int[] arr : counts) {
                    for (int c : arr) affected += (c >= 0 ? c : 0);
                }
                totalAffected += affected;
                batchIndex++;
                log.info("Upserted batch {}/{} ({} rows) in {} ms; JDBC reported affected sum {}", currentBatch, totalBatches, batch.size(), batchMs, affected);
            }
            log.info("Finished native bulk upsert. Total rows processed: {}, JDBC affected sum: {}", toSave.size(), totalAffected);

            messages.add("Results CSV processed. Created: " + createdKeys.size() + ", Updated: " + updatedKeys.size());
            messages.add("Note: year/semester will be set after registrations upload.");

            // Recompute category progress for affected students immediately after Results (Step 1)
            // Recompute only for affected students
            Set<String> recomputeIds = new HashSet<>(affectedStudentIds);
            if (!recomputeIds.isEmpty()) {
                new Thread(() -> {
                    try {
                        log.info("Starting category progress recompute for {} students after Results upload (Step 1)", recomputeIds.size());
                        studentCategoryProgressService.calculateAndUpdateProgressForStudents(recomputeIds);
                        log.info("Completed category progress recompute after Results upload (Step 1)");
                    } catch (Exception ex) {
                        log.error("Progress recalculation error after Results (Step 1): {}", ex.getMessage());
                    }
                }, "progress-recompute-after-results").start();
            } else {
                log.info("No affected students to recompute progress for after Results upload (Step 1)");
            }
        } catch (IOException e) {
            messages.add("Error reading file: " + e.getMessage());
        }

        return messages;
    }

    // Backfill categories for existing grades using program/course mapping
    public List<String> backfillCategories(String programCode) {
        List<String> messages = new ArrayList<>();
        if (programCode == null || programCode.trim().isEmpty()) {
            messages.add("programCode is required");
            return messages;
        }
        try {
            String sql = "UPDATE student_grades sg " +
                "JOIN students s ON s.student_id = sg.university_id " +
                "JOIN programs p ON p.program_id = s.program_id " +
                "JOIN program_course_category pcc ON pcc.course_id = sg.course_id AND pcc.program_id = p.program_id " +
                "JOIN categories c ON c.category_id = pcc.category_id " +
                "SET sg.category = c.category_name " +
                "WHERE (sg.category IS NULL OR sg.category = '') AND p.code = ?";
            int updated = jdbcTemplate.update(sql, programCode.trim());
            messages.add("Backfill updated rows: " + updated);
        } catch (Exception ex) {
            messages.add("Backfill error: " + ex.getMessage());
        }
        return messages;
    }

    // Ensure unique index on (university_id, course_id) to enable ON DUPLICATE KEY UPDATE
    private void ensureUniqueIndexForUpsert() {
        try {
            // Fast path: skip if index already exists
            Integer idxCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS " +
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='student_grades' AND INDEX_NAME='uq_student_grades_uid_course'",
                    Integer.class
            );
            if (idxCount != null && idxCount > 0) {
                log.debug("Unique index uq_student_grades_uid_course already exists; skipping creation.");
                return;
            }
            jdbcTemplate.execute("ALTER TABLE student_grades ADD UNIQUE KEY uq_student_grades_uid_course (university_id, course_id)");
            log.info("Created unique index uq_student_grades_uid_course on (university_id, course_id)");
        } catch (DataAccessException ex) {
            String msg = ex.getMessage();
            if (msg != null && (msg.contains("Duplicate entry") || msg.contains("1062"))) {
                log.warn("Unique index creation failed due to duplicates. Attempting automatic dedup to keep latest rows per (university_id, course_id)...");
                try {
                    jdbcTemplate.execute(
                        "DELETE g FROM student_grades g JOIN (" +
                        " SELECT university_id, course_id, MAX(sno) AS keep_sno" +
                        " FROM student_grades GROUP BY university_id, course_id HAVING COUNT(*) > 1" +
                        ") d ON g.university_id=d.university_id AND g.course_id=d.course_id WHERE g.sno <> d.keep_sno"
                    );
                    log.info("Deduplication completed. Re-attempting unique index creation...");
                    jdbcTemplate.execute("ALTER TABLE student_grades ADD UNIQUE KEY uq_student_grades_uid_course (university_id, course_id)");
                    log.info("Unique index created successfully after dedup.");
                } catch (DataAccessException ex2) {
                    log.error("Failed to create unique index after dedup: {}. Proceeding without index; upsert may insert duplicates for new rows.", ex2.getMessage());
                }
            } else {
                // Likely index already exists or another benign error; log at info
                log.info("Unique index uq_student_grades_uid_course likely exists or cannot be created now: {}", ex.getMessage());
            }
        }
    }

    // Perform chunked INSERT ... ON DUPLICATE KEY UPDATE using JdbcTemplate batchUpdate
    private int[][] bulkUpsertStudentGrades(List<StudentGrade> rows) {
        final String sql = "INSERT INTO student_grades (university_id, grade, grade_point, promotion, category, academic_year, semester, course_id) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE grade=VALUES(grade), grade_point=VALUES(grade_point), promotion=VALUES(promotion), category=VALUES(category), academic_year=VALUES(academic_year), semester=VALUES(semester)";

        // Use Spring's batchUpdate; with rewriteBatchedStatements=true and useServerPrepStmts=false, MySQL will rewrite to multi-row insert
        int[][] counts = jdbcTemplate.batchUpdate(sql, rows, rows.size(), (ps, g) -> {
            ps.setString(1, g.getStudent() != null ? g.getStudent().getStudentId() : null);
            ps.setString(2, g.getGrade());
            if (g.getGradePoint() == null) ps.setObject(3, null);
            else ps.setDouble(3, g.getGradePoint());
            ps.setString(4, g.getPromotion());
            ps.setString(5, g.getCategory());
            ps.setString(6, g.getYear()); // may be null here during Results import
            ps.setString(7, g.getSemester()); // may be null here during Results import
            ps.setInt(8, g.getCourse().getCourseID());
        });
        return counts;
    }

    public List<String> importRegistrationsCsv(MultipartFile file) {
        List<String> messages = new ArrayList<>();
        if (file == null || file.isEmpty()) {
            messages.add("No file uploaded.");
            return messages;
        }

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> lines = br.lines().collect(Collectors.toList());
            if (lines.size() <= 1) {
                messages.add("CSV is empty or header-only.");
                return messages;
            }

            String[] header = parseCsvLine(lines.get(0));
            int idxUid = indexOfHeader(header, "University ID");
            int idxCourse = indexOfHeader(header, "CourseCode");
            int idxYear = indexOfHeader(header, "AcademicYear");
            int idxSem = indexOfHeader(header, "Semester");
            int idxName = indexOfHeader(header, "Name");
            if (idxUid < 0 || idxCourse < 0 || idxYear < 0 || idxSem < 0) {
                messages.add("Required columns missing (University ID, CourseCode, AcademicYear, Semester).");
                return messages;
            }

            // build name map (optional) for student upsert
            Map<String, String> nameById = new HashMap<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] row = parseCsvLine(lines.get(i));
                if (row.length > Math.max(idxUid, idxName)) {
                    String id = safe(row, idxUid);
                    String name = idxName >= 0 ? safe(row, idxName) : "";
                    if (!id.isEmpty() && !name.isEmpty()) nameById.put(id, name);
                }
            }

            // choose latest registration per (uid, course)
            class RegRow { String uid; String code; String year; String sem; int yearStart; int semRank; }
            Map<String, RegRow> latest = new HashMap<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] row = parseCsvLine(lines.get(i));
                if (row.length <= Math.max(Math.max(idxUid, idxCourse), Math.max(idxYear, idxSem))) continue;
                String uid = safe(row, idxUid);
                String code = norm(safe(row, idxCourse));
                String year = safe(row, idxYear);
                String sem = safe(row, idxSem);
                if (uid.isEmpty() || code.isEmpty()) continue;

                int yearStart = parseYearStart(year);
                int rank = semesterRank(sem);
                String key = uid + "-" + code;
                RegRow prev = latest.get(key);
                boolean take = false;
                if (prev == null) take = true;
                else if (yearStart > prev.yearStart) take = true;
                else if (yearStart == prev.yearStart && rank > prev.semRank) take = true;

                if (take) {
                    RegRow r = new RegRow();
                    r.uid = uid; r.code = code; r.year = year; r.sem = sem; r.yearStart = yearStart; r.semRank = rank;
                    latest.put(key, r);
                }
            }

            if (latest.isEmpty()) {
                messages.add("No valid registrations found.");
                return messages;
            }

            // preload existing grades for affected students
            Set<String> studentIds = latest.values().stream().map(r -> r.uid).collect(Collectors.toSet());
            List<StudentGrade> existingGrades = studentGradeRepository.findByStudent_StudentIdIn(studentIds);
            Map<String, StudentGrade> byKey = existingGrades.stream()
                    .filter(g -> g.getCourse() != null && g.getCourse().getCourseCode() != null && g.getStudent() != null)
                    .collect(Collectors.toMap(g -> g.getStudent().getStudentId() + "-" + norm(g.getCourse().getCourseCode()), g -> g, (a,b)->a));

            // preload courses
            Set<String> courseCodes = latest.values().stream().map(r -> r.code).collect(Collectors.toSet());
            Map<String, Courses> courseByCode = coursesRepository.findByCourseCodeIn(new ArrayList<>(courseCodes))
                    .stream()
                    .filter(c -> c.getCourseCode() != null)
                    .collect(Collectors.toMap(c -> norm(c.getCourseCode()), c -> c, (a, b) -> a));
            // find unknown courses
            Set<String> missingCourseCodes = courseCodes.stream()
                    .filter(code -> !courseByCode.containsKey(code))
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            // counts estimation (only consider known courses)
            Set<String> latestKnownKeys = latest.values().stream()
                    .filter(r -> courseByCode.containsKey(r.code))
                    .map(r -> r.uid + "-" + r.code)
                    .collect(Collectors.toSet());
            long updatedCount = latestKnownKeys.stream().filter(byKey::containsKey).count();
            long insertCount = latestKnownKeys.size() - updatedCount;

            TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
            txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

            // Execute everything in one DB transaction/connection to keep TEMP table alive
            txTemplate.execute(status -> {
                // 1) Upsert students in bulk (create missing like Step 1)
                final String upsertStudentsSql = "INSERT INTO students (student_id, student_name, password) VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE student_name=VALUES(student_name)";
                List<String> allStudentIds = new ArrayList<>(studentIds);
                jdbcTemplate.batchUpdate(upsertStudentsSql, allStudentIds, allStudentIds.size(), (ps, sid) -> {
                    ps.setString(1, sid);
                    ps.setString(2, nameById.getOrDefault(sid, ""));
                    ps.setString(3, passwordEncoder.encode(sid));
                });

                // 2) Stage latest registrations into a TEMP table
                jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_registrations");
                jdbcTemplate.execute("CREATE TEMPORARY TABLE tmp_registrations (" +
                        "university_id VARCHAR(64) NOT NULL, " +
                        "course_code VARCHAR(50) NOT NULL, " +
                        "academic_year VARCHAR(20), " +
                        "semester VARCHAR(10), " +
                        "PRIMARY KEY (university_id, course_code)) ENGINE=InnoDB");
                // Speed up join to courses by indexing course_code (PK prefix is university_id, so add separate index)
                jdbcTemplate.execute("CREATE INDEX idx_tmp_reg_course ON tmp_registrations(course_code)");

                final String insTmp = "INSERT INTO tmp_registrations (university_id, course_code, academic_year, semester) VALUES (?, ?, ?, ?)";
                List<RegRow> regs = latest.values().stream()
                        .filter(r -> courseByCode.containsKey(r.code)) // keep only known courses
                        .collect(Collectors.toList());
                AtomicInteger semNormOrTruncCount = new AtomicInteger(0);
                jdbcTemplate.batchUpdate(insTmp, regs, regs.size(), (ps, r) -> {
                    ps.setString(1, r.uid);
                    ps.setString(2, r.code);
                    ps.setString(3, r.year);
                    String nSem = normalizeSemester(r.sem);
                    if (r.sem != null) {
                        String t = r.sem.trim();
                        if (t.length() > 10 && !Objects.equals(nSem, t)) {
                            semNormOrTruncCount.incrementAndGet();
                        }
                    }
                    ps.setString(4, nSem);
                });
                if (semNormOrTruncCount.get() > 0) {
                    log.info("Registrations: normalized/truncated semester for {} rows to fit DB constraints.", semNormOrTruncCount.get());
                }

                // 3) Merge into student_grades in one native upsert
                ensureUniqueIndexForUpsert();
                final String mergeSql = "INSERT INTO student_grades (university_id, course_id, grade, grade_point, promotion, category, academic_year, semester) " +
                        "SELECT r.university_id, c.course_id, NULL, NULL, 'R', COALESCE(cat.category_name, ''), r.academic_year, r.semester " +
                        "FROM tmp_registrations r " +
                        "JOIN courses c ON c.course_code = r.course_code " +
                        "LEFT JOIN students s ON s.student_id = r.university_id " +
                        "LEFT JOIN program_course_category pcc ON pcc.course_id = c.course_id AND pcc.program_id = s.program_id " +
                        "LEFT JOIN categories cat ON cat.category_id = pcc.category_id " +
                        "ON DUPLICATE KEY UPDATE academic_year=VALUES(academic_year), semester=VALUES(semester), category=VALUES(category)";
                // Diagnostics: count rows that will end up with empty category (no mapping found)
                try {
                    String countUnmappedSql = "SELECT COUNT(*) FROM tmp_registrations r " +
                            "JOIN courses c ON c.course_code = r.course_code " +
                            "LEFT JOIN students s ON s.student_id = r.university_id " +
                            "LEFT JOIN program_course_category pcc ON pcc.course_id = c.course_id AND pcc.program_id = s.program_id " +
                            "LEFT JOIN categories cat ON cat.category_id = pcc.category_id " +
                            "WHERE cat.category_id IS NULL";
                    Integer unmappedCount = jdbcTemplate.queryForObject(countUnmappedSql, Integer.class);
                    if (unmappedCount != null && unmappedCount > 0) {
                        String sampleSql = "SELECT DISTINCT r.course_code FROM tmp_registrations r " +
                                "JOIN courses c ON c.course_code = r.course_code " +
                                "LEFT JOIN students s ON s.student_id = r.university_id " +
                                "LEFT JOIN program_course_category pcc ON pcc.course_id = c.course_id AND pcc.program_id = s.program_id " +
                                "LEFT JOIN categories cat ON cat.category_id = pcc.category_id " +
                                "WHERE cat.category_id IS NULL " +
                                "LIMIT 10";
                        List<String> sampleCodes = jdbcTemplate.query(sampleSql, (rs, i) -> rs.getString(1));
                        log.warn("Registrations: {} rows have no mapped category; sample course codes: {}", unmappedCount, sampleCodes);
                    }
                } catch (Exception diagEx) {
                    log.warn("Registrations: diagnostics for category mapping failed: {}", diagEx.getMessage());
                }
                jdbcTemplate.update(mergeSql);

                // 4) Cleanup temp table
                jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_registrations");
                return null;
            });

            // Recalculate progress for affected students asynchronously to reduce endpoint latency
            if (!studentIds.isEmpty()) {
                Set<String> idsForRecalc = new HashSet<>(studentIds);
                new Thread(() -> {
                    try {
                        log.info("Starting category progress recompute for {} students after Registrations upload (Step 2)", idsForRecalc.size());
                        studentCategoryProgressService.calculateAndUpdateProgressForStudents(idsForRecalc);
                        log.info("Completed category progress recompute after Registrations upload (Step 2)");
                    } catch (Exception ex) {
                        log.error("Progress recalculation error after Registrations (Step 2): {}", ex.getMessage());
                    }
                }, "progress-recompute-after-registrations").start();
            } else {
                log.info("No affected students to recompute progress for after Registrations upload (Step 2)");
            }

            if (!missingCourseCodes.isEmpty()) {
                messages.add("Skipped unknown course codes: " + String.join(", ", missingCourseCodes));
            }
            messages.add("Registrations processed. Grades updated: " + updatedCount + ", Missing registrations inserted: " + insertCount);
            messages.add("Processed in a single native SQL merge for performance.");
        } catch (IOException e) {
            messages.add("Error reading file: " + e.getMessage());
        }

        return messages;
    }

    // Helpers
    private int indexOfHeader(String[] header, String name) {
        if (header == null) return -1;
        for (int i = 0; i < header.length; i++) {
            if (name.equalsIgnoreCase(header[i].trim())) return i;
        }
        return -1;
    }

    private String[] parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        values.add(current.toString());
        // trim
        for (int i = 0; i < values.size(); i++) {
            values.set(i, values.get(i) == null ? null : values.get(i).trim());
        }
        return values.toArray(new String[0]);
    }

    private String extractGradeToken(String cell) {
        if (cell == null) return "";
        String beforePipe = cell;
        int idx = cell.indexOf('|');
        if (idx >= 0) beforePipe = cell.substring(0, idx).trim();
        // handle multi-attempt like "A / F"
        if (beforePipe.contains("/")) {
            String[] parts = beforePipe.split("/");
            for (String p : parts) {
                String t = p.trim();
                if (!t.isEmpty()) return t;
            }
            return beforePipe.trim();
        }
        return beforePipe.trim();
    }

    private boolean isFailLike(String g) {
        String s = norm(g);
        return s.equals("DT") || s.equals("NA") || s.equals("F") || s.equals("BLNA");
    }

    private Double mapGradePoint(String g) {
        String s = norm(g);
        switch (s) {
            case "O": return 10.0;
            case "A+": return 9.0;
            case "A": return 8.0;
            case "B+": return 7.0;
            case "B": return 6.0;
            case "C": return 5.0;
            case "P": return 4.0; // fallback if P appears as grade
            default: return 0.0;
        }
    }

    private String safe(String[] arr, int idx) { return (idx >= 0 && idx < arr.length && arr[idx] != null) ? arr[idx].trim() : ""; }

    private String norm(String s) { return s == null ? "" : s.trim().toUpperCase(); }

    private int parseYearStart(String year) {
        if (year == null) return -1;
        // expect formats like "2022-2023"
        String[] parts = year.split("-");
        for (String p : parts) {
            try {
                return Integer.parseInt(p.trim());
            } catch (NumberFormatException ignored) {}
        }
        return -1;
    }

    private int semesterRank(String sem) {
        String s = norm(sem);
        if (s.contains("SUMMER")) return 3;
        if (s.contains("EVEN")) return 2;
        if (s.contains("ODD")) return 1;
        return 0;
    }

    private String normalizeSemester(String sem) {
        if (sem == null) return null;
        String s = sem.trim();
        // common normalizations
        String up = s.toUpperCase(Locale.ROOT);
        if (up.contains("ODD")) up = "ODD";
        else if (up.contains("EVEN")) up = "EVEN";
        else if (up.contains("SUMMER")) up = "SUMMER";
        // ensure fits DB column length (VARCHAR(10) per temp table design)
        if (up.length() > 10) up = up.substring(0, 10);
        return up;
    }
}
