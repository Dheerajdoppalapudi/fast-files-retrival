import React, { useState, useEffect } from "react";
import axios from "axios";
import DiffMatchPatch from "diff-match-patch";

const FileComparison = () => {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [versions, setVersions] = useState([]);
    const [selectedVersions, setSelectedVersions] = useState({ old: "", new: "" });
    const [diffResult, setDiffResult] = useState("");

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const response = await axios.get("http://localhost:8000/files");
            setFiles(Object.entries(response.data.files));
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    const fetchVersions = (fileKey) => {
        setSelectedFile(fileKey);
        setVersions(files.find(([key]) => key === fileKey)?.[1] || []);
    };

    // Fetch file content for a given version
    const fetchFileContent = async (versionId) => {
        try {
            const response = await axios.get("http://localhost:8000/files/content", {
                params: { key: selectedFile, versionId },
            });
            return response.data.content;
        } catch (error) {
            console.error("Error fetching file content:", error);
            return "";
        }
    };

    // Compare two versions
    const compareVersions = async () => {
        if (!selectedVersions.old || !selectedVersions.new) {
            alert("Select both versions to compare!");
            return;
        }

        const oldContent = await fetchFileContent(selectedVersions.old);
        const newContent = await fetchFileContent(selectedVersions.new);

        const dmp = new DiffMatchPatch(); // ✅ Correct instantiation
        const diff = dmp.diff_main(oldContent, newContent);
        dmp.diff_cleanupSemantic(diff);
        setDiffResult(dmp.diff_prettyHtml(diff));
    };

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <h2>File Version Comparison</h2>

            {/* File Selection */}
            <div>
                <h3>select Files</h3>
                {files.map(([key]) => (
                    <button key={key} onClick={() => fetchVersions(key)} style={{ margin: "5px" }}>
                        {key}
                    </button>
                ))}
            </div>

            {/* Version Selection */}
            {selectedFile && (
                <div>
                    <h3>Versions of {selectedFile}</h3>
                    <select onChange={(e) => setSelectedVersions({ ...selectedVersions, old: e.target.value })}>
                        <option value="">Select Old Version</option>
                        {versions.map((v) => (
                            <option key={v.versionId} value={v.versionId}>
                                {v.lastModified} {v.isLatest ? "(Latest)" : ""}
                            </option>
                        ))}
                    </select>

                    <select onChange={(e) => setSelectedVersions({ ...selectedVersions, new: e.target.value })}>
                        <option value="">Select New Version</option>
                        {versions.map((v) => (
                            <option key={v.versionId} value={v.versionId}>
                                {v.lastModified} {v.isLatest ? "(Latest)" : ""}
                            </option>
                        ))}
                    </select>

                    <button onClick={compareVersions} style={{ marginLeft: "10px" }}>Compare</button>
                </div>
            )}

            {/* Diff Result */}
            {diffResult && (
                <div
                    style={{
                        background: "#E2E2E3",
                        padding: "15px",
                        borderRadius: "8px",
                        color: "#333",
                    }}
                >
                    <h3 style={{ marginBottom: "10px", color: "#000", fontWeight: "bold" }}>
                        Comparison Result
                    </h3>
                    <div
                        dangerouslySetInnerHTML={{ __html: diffResult }}
                        style={{
                            background: "#f4f4f4",
                            padding: "15px",
                            borderRadius: "5px",
                            color: "#000",
                            fontSize: "16px",
                            lineHeight: "1.5",
                            wordWrap: "break-word",
                        }}
                    />
                </div>
            )}

        </div>
    );
};

export default FileComparison;