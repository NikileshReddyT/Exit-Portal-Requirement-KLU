import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategories = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHonorsModal, setShowHonorsModal] = useState(false);
  const [draftHonors, setDraftHonors] = useState({});
  const [touchedHonors, setTouchedHonors] = useState({});
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (user?.userType === 'SUPER_ADMIN' && programId) {
        params.append('programId', String(programId));
      } else if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      }

      const qs = params.toString();
      const baseCategories = `${config.backendUrl}/api/v1/admin/data/categories`;
      const baseRequirements = `${config.backendUrl}/api/v1/admin/data/requirements`;
      const [catsRes, reqsRes] = await Promise.all([
        axios.get(qs ? `${baseCategories}?${qs}` : baseCategories, { withCredentials: true }),
        axios.get(qs ? `${baseRequirements}?${qs}` : baseRequirements, { withCredentials: true }),
      ]);

      const categories = Array.isArray(catsRes.data) ? catsRes.data : [];
      const requirements = Array.isArray(reqsRes.data) ? reqsRes.data : [];
      const reqByName = requirements.reduce((acc, r) => {
        const name = r?.categoryName;
        if (name) {
          acc[String(name)] = {
            minCourses: r?.minCourses,
            minCredits: r?.minCredits,
            honorsMinCredits: r?.honorsMinCredits,
            requirementId: r?.id,
          };
        }
        return acc;
      }, {});

      const merged = categories.map((c) => {
        const name = c?.categoryName || c?.name;
        const req = name ? reqByName[String(name)] : undefined;
        return {
          ...c,
          categoryName: name,
          minCourses: req?.minCourses ?? null,
          minCredits: req?.minCredits ?? null,
          honorsMinCredits: req?.honorsMinCredits ?? null,
          requirementId: req?.requirementId ?? null,
        };
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [programId, user?.programId, user?.userType]);

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    fetchRows();
  }, [user, navigate, fetchRows]);

  const handleRowClick = (row) => {
    const name = row.categoryName || row.category || row.name;
    if (name) navigate(`/admin/categories/${encodeURIComponent(String(name))}`);
  };

  const persistedHonorsMap = useMemo(() => {
    return rows.reduce((acc, row) => {
      if (row?.requirementId) {
        acc[row.requirementId] = row?.honorsMinCredits ?? null;
      }
      return acc;
    }, {});
  }, [rows]);

  const showHonorsColumn = useMemo(
    () => rows.some((row) => row?.honorsMinCredits != null),
    [rows]
  );

  const columns = useMemo(() => {
    const base = [
      {
        key: 'categoryName',
        header: 'Category',
        render: (val) => (
          <button
            className=" btn inline-flex items-center px-2.5 py-1 rounded-full text-black hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/categories/${encodeURIComponent(String(val))}`);
            }}
            title={`View category ${val}`}
          >
            {val}
          </button>
        ),
      },
      { key: 'minCourses', header: 'Min Courses', className: 'text-center' },
      { key: 'minCredits', header: 'Min Credits', className: 'text-center' },
    ];

    if (showHonorsColumn) {
      base.push({
        key: 'honorsMinCredits',
        header: 'Honors Min Credits',
        className: 'text-center',
        render: (val) => (val != null ? val : <span className="text-gray-400">—</span>),
      });
    }

    return base;
  }, [navigate, showHonorsColumn]);

  const openHonorsModal = () => {
    const initialDraft = rows.reduce((acc, row) => {
      if (row?.requirementId != null) {
        const persisted = persistedHonorsMap[row.requirementId];
        if (persisted != null) {
          acc[row.requirementId] = String(persisted);
        } else if (row?.minCredits != null) {
          acc[row.requirementId] = '';
        } else {
          acc[row.requirementId] = '';
        }
      }
      return acc;
    }, {});
    setDraftHonors(initialDraft);
    setTouchedHonors({});
    setModalError('');
    setShowHonorsModal(true);
  };

  const closeHonorsModal = () => {
    setShowHonorsModal(false);
    setSaving(false);
  };

  const handleHonorsChange = (requirementId, value) => {
    if (requirementId == null) return;
    setTouchedHonors((prev) => ({
      ...prev,
      [requirementId]: true,
    }));
    setDraftHonors((prev) => ({
      ...prev,
      [requirementId]: value,
    }));
  };

  const handleSaveHonors = async () => {
    if (!draftHonors) return;
    const anyTouched = Object.values(touchedHonors).some(Boolean);
    const updates = [];

    for (const row of rows) {
      const requirementId = row?.requirementId;
      if (!requirementId) continue;

      const previous = persistedHonorsMap[requirementId] ?? null;
      const raw = draftHonors[requirementId];
      const trimmed = raw === undefined ? '' : String(raw ?? '').trim();

      let nextValue;
      if (trimmed === '') {
        if (!anyTouched) {
          nextValue = previous;
        } else if (row?.minCredits != null) {
          nextValue = Number(row.minCredits);
        } else {
          nextValue = null;
        }
      } else {
        const parsed = Number(trimmed);
        if (Number.isNaN(parsed) || parsed < 0) {
          setModalError(`Enter a non-negative number for ${row.categoryName}.`);
          return;
        }
        nextValue = parsed;
      }

      if ((previous ?? null) !== (nextValue ?? null)) {
        updates.push({ requirementId, honorsMinCredits: nextValue });
      }
    }

    if (updates.length === 0) {
      setModalError('No changes to save.');
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      await axios.put(
        `${config.backendUrl}/api/v1/admin/data/requirements/honors`,
        { updates },
        { withCredentials: true }
      );
      setShowHonorsModal(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      setModalError('Failed to update honors requirements. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-600">Browse categories and drill into courses and outcomes</p>
        </div>
        <button
          type="button"
          onClick={openHonorsModal}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          Manage Honors Requirements
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        onRowClick={handleRowClick}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No categories found')}
        enableSearch={false}
        enableColumnFilters={false}
      />

      {showHonorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Manage Honors Requirements</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Adjust honors minimum credits per category. Leave blank to remove the honors requirement for that category.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={closeHonorsModal}
                disabled={saving}
                aria-label="Close honors modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {modalError}
              </div>
            )}

            <div className="mt-5 max-h-80 overflow-y-auto space-y-3 pr-1">
              {rows.map((row) => {
                const requirementId = row?.requirementId;
                const inputValue = requirementId != null ? (draftHonors[requirementId] ?? '') : '';
                const placeholder =
                  requirementId == null
                    ? 'No requirement record'
                    : row?.minCredits != null
                      ? `Leave blank to use ${row.minCredits}`
                      : 'No minimum credits';
                return (
                  <div
                    key={row.categoryName || requirementId || row.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 rounded-xl px-3 py-3"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{row.categoryName}</div>
                      <div className="text-xs text-gray-500">
                        Current honors credits:{' '}
                        {row.honorsMinCredits != null
                          ? row.honorsMinCredits
                          : row.minCredits != null
                            ? `Defaults to ${row.minCredits}`
                            : 'Not set'}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full sm:w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={inputValue}
                      onChange={(e) => handleHonorsChange(requirementId, e.target.value)}
                      placeholder={placeholder}
                      disabled={saving || requirementId == null}
                    />
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="text-center text-sm text-gray-500 py-6">No categories available.</div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={closeHonorsModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleSaveHonors}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Honors Requirements'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCategories;
