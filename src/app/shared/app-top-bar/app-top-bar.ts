import { Component, input, output } from '@angular/core';
import { LucideAngularModule, ShieldCheck, User } from 'lucide-angular';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './app-top-bar.html',
})
export class AppTopBar {
  readonly brandTag = input('FHE Enclave');
  readonly username = input('alice');

  readonly signOut = output<void>();

  readonly ShieldCheckIcon = ShieldCheck;
  readonly UserIcon = User;

  onSignOut(): void {
    this.signOut.emit();
  }
}
