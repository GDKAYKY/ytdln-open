import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const sortOptions = [
    {v:'date-desc', L:'Newest first'},
    {v:'date-asc', L:'Oldest first'},
    {v:'name-asc', L:'Name (A-Z)'},
    {v:'name-desc', L:'Name (Z-A)'},
    {v:'size-desc', L:'Largest first'},
    {v:'size-asc', L:'Smallest first'}
];

const Library = () => {
    const { settings } = useSettings();
    const [files, setFiles] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date-desc');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    const loadFiles = () => {
        if (window.electronAPI) {
            setLoading(true);
            window.electronAPI.getDownloadedFiles({
                musicFolder: settings.musicFolder,
                videoFolder: settings.videoFolder
            });
        }
    };

    useEffect(() => {
        loadFiles();

        if (window.electronAPI) {
            const onList = window.electronAPI.onDownloadedFilesList((data) => {
                setFiles(data);
                setLoading(false);
            });
            const onDeleted = window.electronAPI.onFileDeleted((id) => {
                setFiles(prev => prev.filter(f => f.id !== id));
            });
            
            // Auto refresh after download success
            const onSuccess = window.electronAPI.onDownloadSuccess(() => {
                setTimeout(loadFiles, 1000);
            });

            return () => {
                // cleanup if possible
            };
        }
    }, [settings.musicFolder, settings.videoFolder]);

    useEffect(() => {
        let res = [...files];
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            res = res.filter(f => 
                (f.title && f.title.toLowerCase().includes(lowerTerm)) || 
                (f.fileName && f.fileName.toLowerCase().includes(lowerTerm))
            );
        }
        
        res.sort((a, b) => {
            switch(sortBy) {
                case 'date-desc': return new Date(b.downloadDate) - new Date(a.downloadDate);
                case 'date-asc': return new Date(a.downloadDate) - new Date(b.downloadDate);
                case 'name-asc': return a.title.localeCompare(b.title);
                case 'name-desc': return b.title.localeCompare(a.title);
                case 'size-desc': return b.fileSize - a.fileSize;
                case 'size-asc': return a.fileSize - b.fileSize;
                default: return 0;
            }
        });
        setFilteredFiles(res);
    }, [files, searchTerm, sortBy]);

    const handleOpenFile = (id) => {
        window.electronAPI.openVideoFile(id);
    };

    const handleDelete = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            window.electronAPI.deleteDownloadedFile(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div className="downloads-section">
            <div className="downloads-header">
                <div className="downloads-title-row">
                    <div className="downloads-title">Library</div>
                    <div className="downloads-count">{filteredFiles.length} videos</div>
                </div>
                <div className="downloads-controls">
                    <div className="search-box">
                         <svg className="search-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                         </svg>
                         <input 
                            type="text" 
                            className="search-input" 
                            placeholder="Search videos..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div 
                        className="sort-controls" 
                        style={{position: 'relative'}}
                        onWheel={(e) => {
                            const currentIndex = sortOptions.findIndex(opt => opt.v === sortBy);
                            if (e.deltaY > 0) {
                                const nextIndex = (currentIndex + 1) % sortOptions.length;
                                setSortBy(sortOptions[nextIndex].v);
                            } else {
                                const prevIndex = (currentIndex - 1 + sortOptions.length) % sortOptions.length;
                                setSortBy(sortOptions[prevIndex].v);
                            }
                        }}
                    >
                        <div className="menu sort-menu">
                            <div className={`item ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                <div className="link">
                                    <span>{sortOptions.find(opt => opt.v === sortBy)?.L}</span>
                                    <svg viewBox="0 0 360 360" style={{width:10, height:10, marginLeft: 5}}>
                                      <path d="M325.607,79.393c-5.857-5.857-15.355-5.858-21.213,0.001l-139.39,139.393L25.607,79.393 c-5.857-5.857-15.355-5.858-21.213,0.001c-5.858,5.858-5.858,15.355,0,21.213l150.004,150c2.813,2.813,6.628,4.393,10.606,4.393 s7.794-1.581,10.606-4.394l149.996-150C331.465,94.749,331.465,85.251,325.607,79.393z" fill="currentColor"/>
                                    </svg>
                                </div>
                                <div className="submenu">
                                    {sortOptions.map(opt => (
                                        <div key={opt.v} className="submenu-item" onClick={(e) => {
                                            e.stopPropagation();
                                            setSortBy(opt.v);
                                            setIsMenuOpen(false);
                                        }}>
                                            <div className="submenu-link" style={{cursor: 'pointer', fontWeight: sortBy === opt.v ? 'bold' : 'normal'}}>{opt.L}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button className="refresh-btn" title="Refresh library" onClick={loadFiles}>
                         <svg viewBox="0 0 24 24" fill="none"><path d="M21.5 2V8M21.5 8H16M21.5 8L18 4.5C16.8 3.3 15.2 2.5 13.5 2.1C9.4 1.2 5.4 3.3 3.6 7C1.8 10.7 2.5 15.2 5.5 18.2C8.5 21.2 13 22 17 20.2C20.7 18.5 23 14.9 23 11" stroke="#E3E3E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                </div>
            </div>

            <div className="downloads-container" id="downloadsContainer">
                {loading && <div style={{textAlign: 'center', padding: 20}}>Loading...</div>}
                {!loading && filteredFiles.length === 0 && (
                    <div className="no-downloads-message" style={{display: 'flex'}}>
                        <div className="no-downloads-text">No downloads yet</div>
                        <div className="no-downloads-subtext">Start a download to see completed files here</div>
                    </div>
                )}
                {filteredFiles.map(file => (
                    <div key={file.id} className="download-item" data-file-id={file.id}>
                         <div className="download-item-content">
                            <div className="file-thumbnail">
                                {file.thumbnail && (
                                    <>
                                        <img className="thumbnail-glow" src={file.thumbnail} alt="" aria-hidden="true" />
                                        <img className="thumbnail-main" src={file.thumbnail} alt="Thumbnail" />
                                    </>
                                )}
                            </div>
                            <div className="file-info-container">
                                <div className="file-title">{file.title}</div>
                                <div className="file-path">{file.fileName}</div>
                                <div className="file-details-row">
                                    <span className="file-size">{formatFileSize(file.fileSize)}</span>
                                    {file.duration > 0 && (
                                        <span className="file-duration">{formatDuration(file.duration)}</span>
                                    )}
                                    <span className="file-format">{file.format}</span>
                                </div>
                            </div>
                            <div className="file-actions">
                                <div className="action-buttons">
                                    <svg className="file-icon play-icon" viewBox="0 0 24 24" fill="none" onClick={() => handleOpenFile(file.id)} title="Open file">
                                        <path d="M8 5V19L19 12L8 5Z" stroke="#E3E3E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <svg className="file-icon delete-icon" viewBox="0 0 24 24" fill="none" onClick={() => handleDelete(file.id)} title="Delete file">
                                         <path d="M3 6H5H21" stroke="#E3E3E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                         <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#E3E3E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <div className="file-timestamp">{formatDate(file.downloadDate)}</div>
                            </div>
                         </div>
                    </div>
                ))}
            </div>

            {deleteId && (
                <div id="deletePopup" className={`delete-popup active`}>
                    <div className="delete-popup-overlay" onClick={() => setDeleteId(null)}></div>
                    <div className="delete-popup-content">
                        <div className="delete-popup-header">
                            <div className="delete-popup-icon-wrapper">
                                <div className="delete-popup-icon-bg"></div>
                                <svg className="delete-popup-icon" viewBox="0 0 24 24" fill="none"><path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <div className="delete-popup-title">Delete File</div>
                            <div className="delete-popup-subtitle">This action cannot be undone</div>
                        </div>
                        <div className="delete-popup-body">
                            <div className="delete-popup-filename-label">File to be deleted:</div>
                            <div className="delete-popup-filename">{files.find(f => f.id === deleteId)?.fileName}</div>
                        </div>
                        <div className="delete-popup-footer">
                            <button className="delete-popup-btn delete-popup-btn-cancel" onClick={() => setDeleteId(null)}><span>Cancel</span></button>
                            <button className="delete-popup-btn delete-popup-btn-delete" onClick={confirmDelete}>
                                <svg viewBox="0 0 24 24" fill="none"><path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Library;
