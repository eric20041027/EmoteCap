"""Contain only a newly launched process and its descendants until verified exit."""
import os
import signal
import subprocess
import time

if os.name == 'nt':
    import ctypes
    from ctypes import wintypes as w

    api = ctypes.WinDLL('kernel32', use_last_error=True)

    class Limits(ctypes.Structure):
        _fields_ = [('process_time', ctypes.c_int64), ('job_time', ctypes.c_int64),
                    ('flags', w.DWORD), ('minimum', ctypes.c_size_t), ('maximum', ctypes.c_size_t),
                    ('active_limit', w.DWORD), ('affinity', ctypes.c_size_t),
                    ('priority', w.DWORD), ('scheduling', w.DWORD)]

    class ExtendedLimits(ctypes.Structure):
        _fields_ = [('basic', Limits), ('io', ctypes.c_uint64 * 6),
                    ('memory', ctypes.c_size_t * 4)]

    class Accounting(ctypes.Structure):
        _fields_ = [('times', ctypes.c_int64 * 4), ('faults', w.DWORD),
                    ('total', w.DWORD), ('active', w.DWORD), ('terminated', w.DWORD)]

    class ThreadEntry(ctypes.Structure):
        _fields_ = [('size', w.DWORD), ('usage', w.DWORD), ('thread', w.DWORD),
                    ('owner', w.DWORD), ('priority', w.LONG), ('delta', w.LONG), ('flags', w.DWORD)]

    for name, arguments, result in (
        ('CreateJobObjectW', [ctypes.c_void_p, w.LPCWSTR], w.HANDLE),
        ('SetInformationJobObject', [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD], w.BOOL),
        ('AssignProcessToJobObject', [w.HANDLE, w.HANDLE], w.BOOL),
        ('TerminateJobObject', [w.HANDLE, w.UINT], w.BOOL),
        ('QueryInformationJobObject', [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD, ctypes.c_void_p], w.BOOL),
        ('CreateToolhelp32Snapshot', [w.DWORD, w.DWORD], w.HANDLE),
        ('Thread32First', [w.HANDLE, ctypes.POINTER(ThreadEntry)], w.BOOL),
        ('Thread32Next', [w.HANDLE, ctypes.POINTER(ThreadEntry)], w.BOOL),
        ('OpenThread', [w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
        ('ResumeThread', [w.HANDLE], w.DWORD),
        ('CloseHandle', [w.HANDLE], w.BOOL),
    ):
        function = getattr(api, name)
        function.argtypes = arguments
        function.restype = result

    def checked(value):
        if not value:
            raise ctypes.WinError(ctypes.get_last_error())
        return value

    def resume_owned_primary(pid):
        snapshot = api.CreateToolhelp32Snapshot(4, 0)
        if snapshot == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            entry = ThreadEntry()
            entry.size = ctypes.sizeof(entry)
            found = api.Thread32First(snapshot, ctypes.byref(entry))
            while found:
                if entry.owner == pid:
                    thread = checked(api.OpenThread(2, False, entry.thread))
                    try:
                        if api.ResumeThread(thread) == 0xffffffff:
                            raise ctypes.WinError(ctypes.get_last_error())
                    finally:
                        api.CloseHandle(thread)
                    return
                entry.size = ctypes.sizeof(entry)
                found = api.Thread32Next(snapshot, ctypes.byref(entry))
            raise RuntimeError('New suspended process has no owned primary thread')
        finally:
            api.CloseHandle(snapshot)


class OwnedProcess:
    """Create suspended on Windows; assign the job before executing user code."""
    def __init__(self, command, **kwargs):
        self.process = None
        self.job = None
        self.closed = False
        try:
            if os.name == 'nt':
                self.job = checked(api.CreateJobObjectW(None, None))
                limits = ExtendedLimits()
                limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                checked(api.SetInformationJobObject(self.job, 9, ctypes.byref(limits), ctypes.sizeof(limits)))
                kwargs['creationflags'] = kwargs.get('creationflags', 0) | 4 | subprocess.CREATE_NO_WINDOW
            else:
                kwargs['start_new_session'] = True
            self.process = subprocess.Popen(command, **kwargs)
            if os.name == 'nt':
                checked(api.AssignProcessToJobObject(self.job, int(self.process._handle)))
                resume_owned_primary(self.process.pid)
        except BaseException:
            self.close()
            raise

    def close(self):
        if self.closed:
            return
        try:
            if self.job is not None:
                checked(api.TerminateJobObject(self.job, 1))
            elif self.process is not None and os.name != 'nt':
                try:
                    os.killpg(self.process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            if self.process is not None:
                if self.process.poll() is None and os.name == 'nt':
                    self.process.kill()  # Also covers failure before job assignment.
                self.process.wait(timeout=10)
            if self.job is not None:
                deadline = time.monotonic() + 10
                while True:
                    state = Accounting()
                    checked(api.QueryInformationJobObject(self.job, 1, ctypes.byref(state), ctypes.sizeof(state), None))
                    if state.active == 0:
                        break
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Owned process tree did not become terminal')
                    time.sleep(.01)
            self.closed = True
        finally:
            if self.job is not None:
                api.CloseHandle(self.job)
                self.job = None

    def __enter__(self):
        return self.process

    def __exit__(self, *_):
        self.close()
