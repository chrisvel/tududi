// Column tracks shared by the projects table header and its rows. Cells that
// are hidden at a breakpoint drop out of the grid, so each breakpoint lists
// only the columns it shows: name, status, summary (xl), members (lg), due
// and progress (md), actions.
export const PROJECT_TABLE_GRID =
    'grid items-center gap-3 grid-cols-[minmax(0,1fr)_auto_2rem] md:grid-cols-[minmax(0,1fr)_7rem_9rem_8rem_2rem] lg:grid-cols-[minmax(0,1fr)_7rem_6.5rem_9rem_8rem_2rem] xl:grid-cols-[minmax(0,1.4fr)_7rem_minmax(0,1fr)_6.5rem_9rem_8rem_2rem]';
