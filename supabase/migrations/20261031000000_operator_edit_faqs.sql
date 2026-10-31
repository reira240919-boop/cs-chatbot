-- 納品前: スタッフが画面から FAQ を追加・修正・削除できるようにする
-- お客様（匿名ログイン）は、今までどおり見ることも変えることもできない
grant insert, update, delete on faqs to authenticated;

create policy "operator_insert_faqs" on faqs
  for insert to authenticated with check (is_operator());

create policy "operator_update_faqs" on faqs
  for update to authenticated using (is_operator()) with check (is_operator());

create policy "operator_delete_faqs" on faqs
  for delete to authenticated using (is_operator());
