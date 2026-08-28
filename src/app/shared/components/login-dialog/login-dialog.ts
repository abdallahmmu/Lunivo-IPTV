import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppError } from '../../../core/models/common.models';
import { AuthService } from '../../../core/services/auth.service';
import { LogoMark } from '../logo-mark/logo-mark';

@Component({
  selector: 'app-login-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LogoMark],
  templateUrl: './login-dialog.html',
})
export class LoginDialog {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly closed = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    serverUrl: ['', [Validators.required]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.submitting()) this.closed.emit();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const { serverUrl, username, password, rememberMe } = this.form.getRawValue();
    const { error } = await this.auth.connect({ serverUrl, username, password }, rememberMe);

    this.submitting.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    await this.router.navigateByUrl('/home');
  }
}
