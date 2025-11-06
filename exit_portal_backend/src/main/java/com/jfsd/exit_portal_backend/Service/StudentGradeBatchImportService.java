package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
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

    // Performance helper: ensure helpful non-unique indexes exist (safe no-op if already present)
    private void ensurePerformanceIndexes() {
        try {
            Integer hasCourses = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='courses' AND INDEX_NAME='idx_courses_code'",
                    Integer.class);
            if (hasCourses == null || hasCourses == 0) {
                jdbcTemplate.execute("ALTER TABLE courses ADD INDEX idx_courses_code (course_code)");
            }
        } catch (Exception ignored) {}
        try {
            Integer hasPcc = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='program_course_category' AND INDEX_NAME='idx_pcc_course_program'",
                    Integer.class);
            if (hasPcc == null || hasPcc == 0) {
                jdbcTemplate.execute("ALTER TABLE program_course_category ADD INDEX idx_pcc_course_program (course_id, program_id)");
            }
        } catch (Exception ignored) {}
        try {
            Integer hasScpUid = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='student_category_progress' AND INDEX_NAME='idx_scp_uid'",
                    Integer.class);
            if (hasScpUid == null || hasScpUid == 0) {
                jdbcTemplate.execute("ALTER TABLE student_category_progress ADD INDEX idx_scp_uid (university_id)");
            }
        } catch (Exception ignored) {}
        // student_grades unique index is managed by ensureUniqueIndexForUpsert(); avoid adding overlapping non-unique index
    }

    // Fail-fast check for read-only DB to avoid long processing before erroring
    private boolean isDatabaseReadOnly() {
        try {
            Map<String, Object> v = jdbcTemplate.queryForMap("SELECT @@global.read_only AS r, @@global.super_read_only AS sr");
            Object r = v.get("r");
            Object sr = v.get("sr");
            return (r != null && ("1".equals(r.toString()) || "ON".equalsIgnoreCase(r.toString()))) ||
                   (sr != null && ("1".equals(sr.toString()) || "ON".equalsIgnoreCase(sr.toString())));
        } catch (Exception ignored) {
            return false;
        }
    }

    

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

    private static final int BATCH_SIZE = 20000; // larger batches for fewer DB round-trips

    @Transactional
    public List<String> importResultsCsv(MultipartFile file, String programCode, Double defaultCredits) {
        List<String> messages = new ArrayList<>();
        long _svcStartMs = System.currentTimeMillis();
        log.info("Results import started at epoch(ms)={}", _svcStartMs);
        if (file == null || file.isEmpty()) {
            messages.add("No file uploaded.");
            long _svcEndMs = System.currentTimeMillis();
            double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
            log.info("Results import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
            return messages;
        }
        // Fail fast if DB is read-only
        if (isDatabaseReadOnly()) {
            messages.add("Abort: Database is read-only (read_only/super_read_only enabled). Point DB_URL to the writer endpoint or disable read-only on the server.");
            long _svcEndMs = System.currentTimeMillis();
            double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
            log.info("Results import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
            return messages;
        }
        // Ensure helpful indexes for fast joins
        ensurePerformanceIndexes();

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
            final Long programIdForOps = (programEntity != null ? programEntity.getProgramId() : null);

            // Preload existing grades for all students in the CSV for faster upsert
            Set<String> studentIds = lines.stream().skip(1)
                    .parallel()
                    .map(this::parseCsvLine)
                    .filter(arr -> arr.length > 0 && arr[0] != null && !arr[0].trim().isEmpty())
                    .map(arr -> arr[0].trim())
                    .collect(Collectors.toSet());
            log.info("Unique students in Results CSV: {}", studentIds.size());

            // Upsert Students: create any missing (password = BCrypt(studentId)), leave existing unchanged, and set program only if NULL
            Map<String, Student> existingStudents = studentRepository.findAllByStudentIdIn(studentIds)
                    .stream().collect(Collectors.toMap(Student::getStudentId, s -> s));
            final ConcurrentHashMap<String, Boolean> failureByStudent = new ConcurrentHashMap<>();
            existingStudents.forEach((sid, student) -> failureByStudent.put(sid, student.isHasAnyFailure()));
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
            // Create missing only - each student's password must be hash of their student ID for authentication
            Set<String> toCreateIds = new java.util.HashSet<>(studentIds);
            toCreateIds.removeAll(existingStudents.keySet());
            final String insStudents = "INSERT IGNORE INTO students (student_id, student_name, password, program_id) VALUES (?, ?, ?, ?)";
            if (!toCreateIds.isEmpty()) {
                long tHashStart = System.nanoTime();
                // Hash each student ID individually in parallel - required for proper authentication
                Map<String, String> hashedPasswords = toCreateIds.parallelStream()
                    .collect(Collectors.toMap(id -> id, id -> passwordEncoder.encode(id)));
                long tHashMs = (System.nanoTime() - tHashStart) / 1_000_000;
                log.info("Hashed passwords for {} new students in {} ms", toCreateIds.size(), tHashMs);

                List<String> idList = new ArrayList<>(toCreateIds);
                jdbcTemplate.batchUpdate(insStudents, idList, idList.size(), (ps, sid) -> {
                    ps.setString(1, sid);
                    ps.setString(2, nameById.getOrDefault(sid, ""));
                    ps.setString(3, hashedPasswords.get(sid));  // Each student gets hash of their ID
                    ps.setObject(4, programIdForOps);
                });
                log.info("Created {} new students via JDBC INSERT IGNORE", idList.size());
            }
            toCreateIds.forEach(id -> failureByStudent.putIfAbsent(id, Boolean.FALSE));
            // Set program_id only for students with NULL (existing semantics)
            if (programIdForOps != null && !studentIds.isEmpty()) {
                final int CHUNK = 1000;
                List<String> allIdsList = new ArrayList<>(studentIds);
                for (int i = 0; i < allIdsList.size(); i += CHUNK) {
                    List<String> chunk = allIdsList.subList(i, Math.min(i + CHUNK, allIdsList.size()));
                    String placeholders = String.join(", ", java.util.Collections.nCopies(chunk.size(), "?"));
                    String upd = "UPDATE students SET program_id=? WHERE program_id IS NULL AND student_id IN (" + placeholders + ")";
                    jdbcTemplate.update(con -> {
                        java.sql.PreparedStatement ps = con.prepareStatement(upd);
                        int idx = 1;
                        ps.setObject(idx++, programIdForOps);
                        for (String s : chunk) ps.setString(idx++, s);
                        return ps;
                    });
                }
            }
            // Build skip list for program mismatches (same semantics)
            Set<String> skipStudentIds = new HashSet<>();
            if (programEntity != null) {
                for (String id : studentIds) {
                    Student s = existingStudents.get(id);
                    if (s == null) continue;
                    Program sp = s.getProgram();
                    if (sp != null && !Objects.equals(sp.getProgramId(), programEntity.getProgramId())) {
                        skipStudentIds.add(id);
                    }
                }
                if (!skipStudentIds.isEmpty()) {
                    messages.add("Skipped students due to program mismatch with " + programCode.trim() + ": " + String.join(", ", skipStudentIds));
                }
            }
            // Defer existing grade preload until after we know exactly which (uid, course) pairs are needed
            // Parse rows in parallel to build updates, logging every 10 rows
            AtomicInteger parsedRowCounter = new AtomicInteger(0);
            long tUpdatesStart = System.nanoTime();
            List<ParsedUpdate> updates = lines.subList(1, lines.size()).parallelStream()
                    .map(this::parseCsvLine)
                    .filter(row -> row.length > firstCourseCol && row[0] != null && !row[0].trim().isEmpty())
                    .flatMap(row -> {
                        int rowNum = parsedRowCounter.incrementAndGet();
                        if (rowNum % 10000 == 0) {
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
                            if (!failureByStudent.getOrDefault(universityId, Boolean.FALSE)) {
                                boolean hasFailAttempt = hasFailureAttempt(cell);
                                if (hasFailAttempt) failureByStudent.put(universityId, Boolean.TRUE);
                            }
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

            // Build distinct (uid, course_code) pairs and precompute which already exist via fast SQL with optimized query
            long tExistStart = System.nanoTime();
            Set<String> distinctKeys = new HashSet<>();
            for (ParsedUpdate u : updates) distinctKeys.add(u.universityId + "-" + u.courseCode);
            
            // Skip existence check entirely - let ON DUPLICATE KEY UPDATE handle it (faster)
            // We'll mark all as "created" for stats, actual behavior is upsert
            Set<String> existingKeys = new HashSet<>();  // Empty set = treat all as new for stats
            
            long tExistMs = (System.nanoTime() - tExistStart) / 1_000_000;
            log.info("Skipped existing key check (will be handled by upsert); {} distinct pairs in {} ms", distinctKeys.size(), tExistMs);

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
                    boolean existed = existingKeys.contains(key);
                    grade = new StudentGrade();
                    Student s = existingStudents.get(u.universityId);
                    if (s == null) { s = new Student(); s.setStudentId(u.universityId); }
                    grade.setStudent(s);
                    if (existed) updatedKeys.add(key); else createdKeys.add(key);
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

            // Students were ensured above; no redundant ensure-exist needed here

            // Bulk upsert in the current transaction (students are flushed above)
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

            if (!failureByStudent.isEmpty()) {
                List<String> toUpdateFailure = failureByStudent.entrySet().stream()
                        .filter(Map.Entry::getValue)
                        .map(Map.Entry::getKey)
                        .collect(Collectors.toList());
                if (!toUpdateFailure.isEmpty()) {
                    final int chunkSize = 1000;
                    for (int i = 0; i < toUpdateFailure.size(); i += chunkSize) {
                        List<String> chunk = toUpdateFailure.subList(i, Math.min(i + chunkSize, toUpdateFailure.size()));
                        String placeholders = String.join(", ", java.util.Collections.nCopies(chunk.size(), "?"));
                        String sql = "UPDATE students SET has_any_failure = 1 WHERE has_any_failure = 0 AND student_id IN (" + placeholders + ")";
                        jdbcTemplate.update(con -> {
                            java.sql.PreparedStatement ps = con.prepareStatement(sql);
                            int idx = 1;
                            for (String sid : chunk) ps.setString(idx++, sid);
                            return ps;
                        });
                    }
                }
            }

            // Recompute category progress AFTER COMMIT to ensure Step 1 changes are visible
            Set<String> recomputeIds = new HashSet<>(affectedStudentIds);
            if (!recomputeIds.isEmpty()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        new Thread(() -> {
                            try {
                                log.info("Starting category progress recompute for {} students after Results upload (Step 1)", recomputeIds.size());
                                studentCategoryProgressService.calculateAndUpdateProgressForStudents(recomputeIds);
                                log.info("Completed category progress recompute after Results upload (Step 1)");
                            } catch (Exception ex) {
                                log.error("Progress recalculation error after Results (Step 1): {}", ex.getMessage());
                            }
                        }, "progress-recompute-after-results").start();
                    }
                });
            } else {
                log.info("No affected students to recompute progress for after Results upload (Step 1)");
            }
        } catch (IOException e) {
            messages.add("Error reading file: " + e.getMessage());
        }
        long _svcEndMs = System.currentTimeMillis();
        double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
        log.info("Results import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
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

    @Transactional
    public List<String> importRegistrationsCsv(MultipartFile file) {
        List<String> messages = new ArrayList<>();
        long _svcStartMs = System.currentTimeMillis();
        log.info("Registrations import started at epoch(ms)={}", _svcStartMs);
        if (file == null || file.isEmpty()) {
            messages.add("No file uploaded.");
            long _svcEndMs = System.currentTimeMillis();
            double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
            log.info("Registrations import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
            return messages;
        }
        // Fail fast if DB is read-only
        if (isDatabaseReadOnly()) {
            messages.add("Abort: Database is read-only (read_only/super_read_only enabled). Point DB_URL to the writer endpoint or disable read-only on the server.");
            long _svcEndMs = System.currentTimeMillis();
            double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
            log.info("Registrations import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
            return messages;
        }
        // Ensure helpful indexes for fast joins
        ensurePerformanceIndexes();

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

            // Collect student IDs appearing in the registrations payload
            Set<String> studentIds = latest.values().stream()
                    .map(r -> r.uid)
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            // counts computed after staging tmp table
            final long[] counts = new long[2]; // [0]=updatedCount, [1]=insertCount

            TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
            txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

            // Execute everything in one DB transaction/connection to keep TEMP table alive
            txTemplate.execute(status -> {
                // 1) Create missing students only; update names separately to avoid hashing existing
                List<String> allStudentIds = new ArrayList<>(studentIds);
                java.util.Set<String> existingIdSet = new java.util.HashSet<>();
                final int ID_CHUNK = 1000;
                for (int i = 0; i < allStudentIds.size(); i += ID_CHUNK) {
                    List<String> chunk = allStudentIds.subList(i, Math.min(i + ID_CHUNK, allStudentIds.size()));
                    String placeholders = String.join(", ", java.util.Collections.nCopies(chunk.size(), "?"));
                    String sel = "SELECT student_id FROM students WHERE student_id IN (" + placeholders + ")";
                    existingIdSet.addAll(jdbcTemplate.query(sel, ps -> {
                        int idx = 1; for (String s : chunk) ps.setString(idx++, s);
                    }, (rs, rNum) -> rs.getString(1)));
                }
                java.util.Set<String> toCreateIds = new java.util.HashSet<>(studentIds);
                toCreateIds.removeAll(existingIdSet);
                if (!toCreateIds.isEmpty()) {
                    long tHashStart = System.nanoTime();
                    // Hash each student ID individually in parallel - required for proper authentication
                    Map<String, String> hashedPasswords = toCreateIds.parallelStream()
                        .collect(Collectors.toMap(id -> id, id -> passwordEncoder.encode(id)));
                    long tHashMs = (System.nanoTime() - tHashStart) / 1_000_000;
                    log.info("Hashed passwords for {} new students in {} ms", toCreateIds.size(), tHashMs);
                    
                    List<String> createList = new ArrayList<>(toCreateIds);
                    final String insSql = "INSERT IGNORE INTO students (student_id, student_name, password) VALUES (?, ?, ?)";
                    jdbcTemplate.batchUpdate(insSql, createList, createList.size(), (ps, sid) -> {
                        ps.setString(1, sid);
                        ps.setString(2, nameById.getOrDefault(sid, ""));
                        ps.setString(3, hashedPasswords.get(sid));  // Each student gets hash of their ID
                    });
                    log.info("Created {} new students via JDBC INSERT IGNORE", createList.size());
                }
                // Update names for all relevant students (no password hashing overhead)
                jdbcTemplate.batchUpdate("UPDATE students SET student_name=? WHERE student_id=?", allStudentIds, allStudentIds.size(), (ps, sid) -> {
                    ps.setString(1, nameById.getOrDefault(sid, ""));
                    ps.setString(2, sid);
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
                // Compute counts via SQL after staging
                Integer total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tmp_registrations", Integer.class);
                Integer existing = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM tmp_registrations r " +
                                "JOIN courses c ON c.course_code = r.course_code " +
                                "JOIN student_grades sg ON sg.university_id = r.university_id AND sg.course_id = c.course_id",
                        Integer.class);
                int tot = (total == null ? 0 : total);
                int upd = (existing == null ? 0 : existing);
                counts[0] = upd;
                counts[1] = Math.max(0, tot - upd);

                // 3) Set-based UPDATE of existing rows then INSERT only missing rows
                ensureUniqueIndexForUpsert();
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
                final String updSql =
                        "UPDATE student_grades sg " +
                        "JOIN tmp_registrations r ON sg.university_id = r.university_id " +
                        "JOIN courses c ON c.course_code = r.course_code AND c.course_id = sg.course_id " +
                        "LEFT JOIN students s ON s.student_id = r.university_id " +
                        "LEFT JOIN program_course_category pcc ON pcc.course_id = c.course_id AND pcc.program_id = s.program_id " +
                        "LEFT JOIN categories cat ON cat.category_id = pcc.category_id " +
                        "SET sg.academic_year = r.academic_year, sg.semester = r.semester, sg.category = COALESCE(cat.category_name, '')";
                int updRows = jdbcTemplate.update(updSql);
                log.info("Registrations: updated existing rows: {}", updRows);

                final String insMissingSql =
                        "INSERT INTO student_grades (university_id, course_id, grade, grade_point, promotion, category, academic_year, semester) " +
                        "SELECT r.university_id, c.course_id, NULL, NULL, 'R', COALESCE(cat.category_name, ''), r.academic_year, r.semester " +
                        "FROM tmp_registrations r " +
                        "JOIN courses c ON c.course_code = r.course_code " +
                        "LEFT JOIN students s ON s.student_id = r.university_id " +
                        "LEFT JOIN program_course_category pcc ON pcc.course_id = c.course_id AND pcc.program_id = s.program_id " +
                        "LEFT JOIN categories cat ON cat.category_id = pcc.category_id " +
                        "LEFT JOIN student_grades sg ON sg.university_id = r.university_id AND sg.course_id = c.course_id " +
                        "WHERE sg.university_id IS NULL";
                int insRows = jdbcTemplate.update(insMissingSql);
                log.info("Registrations: inserted missing rows: {}", insRows);

                // 4) Cleanup temp table
                jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_registrations");
                return null;
            });

            // Recalculate progress AFTER COMMIT for affected students (Step 2)
            if (!studentIds.isEmpty()) {
                Set<String> idsForRecalc = new HashSet<>(studentIds);
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        new Thread(() -> {
                            try {
                                log.info("Starting category progress recompute for {} students after Registrations upload (Step 2)", idsForRecalc.size());
                                studentCategoryProgressService.calculateAndUpdateProgressForStudents(idsForRecalc);
                                log.info("Completed category progress recompute after Registrations upload (Step 2)");
                            } catch (Exception ex) {
                                log.error("Progress recalculation error after Registrations (Step 2): {}", ex.getMessage());
                            }
                        }, "progress-recompute-after-registrations").start();
                    }
                });
            } else {
                log.info("No affected students to recompute progress for after Registrations upload (Step 2)");
            }

            if (!missingCourseCodes.isEmpty()) {
                messages.add("Skipped unknown course codes: " + String.join(", ", missingCourseCodes));
            }
            messages.add("Registrations processed. Grades updated: " + counts[0] + ", Missing registrations inserted: " + counts[1]);
            messages.add("Processed in a single native SQL merge for performance.");
        } catch (IOException e) {
            messages.add("Error reading file: " + e.getMessage());
        }
        long _svcEndMs = System.currentTimeMillis();
        double _durSec = (_svcEndMs - _svcStartMs) / 1000.0;
        log.info("Registrations import finished at epoch(ms)={} duration(s)={}", _svcEndMs, String.format(java.util.Locale.ROOT, "%.3f", _durSec));
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

    private boolean hasFailureAttempt(String cell) {
        if (cell == null) return false;
        String beforePipe = cell;
        int pipeIdx = cell.indexOf('|');
        if (pipeIdx >= 0) {
            beforePipe = cell.substring(0, pipeIdx);
        }
        String[] attempts = beforePipe.split("/");
        for (String attempt : attempts) {
            if (attempt == null) continue;
            String token = attempt.trim();
            if (token.isEmpty()) continue;
            int spaceIdx = token.indexOf(' ');
            if (spaceIdx > 0) {
                token = token.substring(0, spaceIdx);
            }
            int parenIdx = token.indexOf('(');
            if (parenIdx > 0) {
                token = token.substring(0, parenIdx);
            }
            if (isFailLike(token)) {
                return true;
            }
        }
        return false;
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
