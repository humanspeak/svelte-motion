<script lang="ts">
    import * as Tabs from '$lib/shadcn/ui/tabs'
</script>

<div class="w-full max-w-md">
    <Tabs.Root value="account">
        <Tabs.List>
            <Tabs.Trigger value="account">Account</Tabs.Trigger>
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content
            value="account"
            class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
        >
            <h3 class="text-lg font-semibold">Account</h3>
            <p class="mt-2 text-sm text-muted-foreground">
                Make changes to your account here. Click save when you're done.
            </p>
            <div class="mt-4 space-y-2">
                <label class="text-sm font-medium" for="name">Name</label>
                <input
                    id="name"
                    class="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    placeholder="Enter your name"
                />
            </div>
        </Tabs.Content>
        <Tabs.Content
            value="password"
            class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
        >
            <h3 class="text-lg font-semibold">Password</h3>
            <p class="mt-2 text-sm text-muted-foreground">
                Change your password here. After saving, you'll be logged out.
            </p>
            <div class="mt-4 space-y-2">
                <label class="text-sm font-medium" for="current">Current password</label>
                <input
                    id="current"
                    type="password"
                    class="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
            </div>
        </Tabs.Content>
        <Tabs.Content
            value="settings"
            class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
        >
            <h3 class="text-lg font-semibold">Settings</h3>
            <p class="mt-2 text-sm text-muted-foreground">
                Configure your preferences and notification settings.
            </p>
            <div class="mt-4 flex items-center gap-2">
                <input id="notifications" type="checkbox" class="h-4 w-4 accent-primary" />
                <label class="text-sm font-medium" for="notifications">
                    Enable notifications
                </label>
            </div>
        </Tabs.Content>
    </Tabs.Root>
</div>
