package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Service.CombinedImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.cache.CacheManager;

import java.util.List;

@RestController
@RequestMapping("/api/combined")
@CrossOrigin
public class CombinedImportController {

    @Autowired
    private CombinedImportService combinedImportService;

    @Autowired
    private CacheManager cacheManager;

    @PostMapping("/upload")
    public ResponseEntity<List<String>> uploadCombined(
            @RequestParam("file") MultipartFile file,
            @RequestParam("programCode") String programCode,
            @RequestParam(value = "defaultCredits", required = false) Double defaultCredits
    ) {
        try {
            List<String> messages = combinedImportService.importCombinedCsv(file, programCode, defaultCredits);
            // Evict cached admin insights so dashboards reflect latest data immediately
            if (cacheManager != null && cacheManager.getCache("admin_api") != null) {
                cacheManager.getCache("admin_api").clear();
            }
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error processing file: " + e.getMessage()));
        }
    }
}
